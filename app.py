from flask import Flask, render_template, request, jsonify, send_file
from flask_cors import CORS
import pandas as pd
import numpy as np
from scipy.signal import find_peaks, butter, filtfilt
import zipfile, io, os
import time
from vg_beat_detectors import FastNVG

app = Flask(__name__)
CORS(app)  # 支持跨域请求

UPLOAD_FOLDER = 'uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

def safe_read_csv(filepath, **kwargs):
    encodings = ["utf-8", "utf-8-sig", "gbk", "gb2312", "latin1"]
    for enc in encodings:
        try:
            return pd.read_csv(filepath, encoding=enc, **kwargs)
        except Exception as e:
            continue
    raise ValueError("❌ 无法识别文件编码，请确认 CSV 文件格式")

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/process', methods=['POST'])
def process():
    start_time = time.time()  # starting time
    try:
        file = request.files['file']
        lead = request.form.get('lead')  # ✅ 接收导联参数

        if file.filename.endswith('.csv'):
            # 保存上传的文件
            filepath = os.path.join(app.config['UPLOAD_FOLDER'], file.filename)
            file.save(filepath)

            # 先读取列名
            df_header = safe_read_csv(filepath, nrows=0)
            columns = df_header.columns.tolist()
            # ✅ 确保用户选择的导联在文件中
            if lead not in columns:
                return jsonify({'error': f"Lead '{lead}' not found in CSV."}), 400

            time_col = columns[-1]  # 假设第一列是时间戳
            
            df = safe_read_csv(filepath, usecols=[lead, time_col])    # 只读取需要的两列

            # 加载 ECG 数据
            ecg_signal = df[lead].values
            timestamps = df[time_col].values
            fs = 1 / np.mean(np.diff(timestamps))
            print(f"⚙️ Calculated sampling rate: {fs:.2f} Hz")
            fs = int(round(fs))  # ✅ 强制变成整数

            # ** 预处理 ECG 信号**
            ecg_signal = np.nan_to_num(ecg_signal, nan=np.nanmean(ecg_signal)) # 处理NaN

            # Calculate R peaks
            detector = FastNVG(sampling_frequency=fs)
            peaks = detector.find_peaks(ecg_signal)
            peaks = np.array(peaks, dtype=int)  # ← 强制转整数

            print(f"✅ Detected {len(peaks)} R-peaks")
            
            # 计算 RR 间期
            rr_intervals = np.diff(peaks) / fs  # 单位：秒
            # 转换为 NumPy 数组并确保是 float 类型
            rr_intervals = np.array(rr_intervals, dtype=np.float64)

            # 计算有效长度（确保是 int）
            n = int((len(rr_intervals) // 3) * 3)
            rr_arr = rr_intervals[:n]  # 确保切片整数

            # 滑动窗口组成三元组（不重叠）
            # rr_arr = rr_intervals[:(len(rr_intervals) // 3) * 3]
            if len(rr_arr) == 0 or len(rr_arr) % 3 != 0:
                return jsonify({'error': 'Not enough valid RR intervals to form triplets'}), 400
            rr_triples = rr_arr.reshape((-1, 3))
            
            # 归一化为组成数据（simplex），每组三个值之和为1
            normalized = np.array(rr_triples) / np.sum(rr_triples, axis=1, keepdims=True)

            os.makedirs("exports", exist_ok=True)

            # 保存 CSV
            base_name = os.path.splitext(file.filename)[0]
            rpeaks_path = os.path.join("exports", f"rpeaks_{base_name}.csv")
            rr_path = os.path.join("exports", f"rr_intervals_{base_name}.csv")
            normalized_path = os.path.join("exports", f"normalized_{base_name}.csv")

            pd.DataFrame({"rpeaks": peaks}).to_csv(rpeaks_path, index=False)
            pd.DataFrame({"rr_intervals": rr_intervals}).to_csv(rr_path, index=False)
            pd.DataFrame(normalized, columns=["c1", "c2", "c3"]).to_csv(normalized_path, index=False)

            pd.DataFrame(normalized, columns=["c1", "c2", "c3"]).to_csv(normalized_path, index=False)


            end_time = time.time()  # 结束时间
            print(f"⏱️ Processing time: {end_time - start_time:.3f} seconds")
            return jsonify({
                "normalized": normalized.tolist(),
                "basename": base_name
            })
        else:
            return "Invalid file format", 400
    except Exception as e:
        print("⚠️ 发生异常：", str(e))
        return jsonify({'error': str(e)}), 500

@app.route('/upload_image', methods=['POST'])
def upload_image():
    try:
        file = request.files['image']
        filename = request.form['filename']
        export_path = os.path.join("exports", filename)
        file.save(export_path)

        # 删除旧图（如果上传的是 png，就删除 svg，反之亦然）
        alt_ext = ".svg" if filename.endswith(".png") else ".png"
        alt_path = os.path.join("exports", filename.rsplit(".", 1)[0] + alt_ext)
        if os.path.exists(alt_path):
            os.remove(alt_path)

        return "Uploaded", 200
    except Exception as e:
        print("❌ Upload image error:", str(e))
        return "Failed", 500



@app.route('/export')
def export():
    base_name = request.args.get("basename")
    if not base_name:
        return "Missing basename parameter", 400
    
    export_r = request.args.get("rpeaks") == "1"
    export_rr = request.args.get("rr") == "1"
    export_img = request.args.get("img") == "1"
    export_norm = request.args.get("norm") == "1"


    export_dir = "exports"
    files = []

    if export_r:
        files.append((f"rpeaks_{base_name}.csv", os.path.join(export_dir, f"rpeaks_{base_name}.csv")))
    if export_rr:
        files.append((f"rr_intervals_{base_name}.csv", os.path.join(export_dir, f"rr_intervals_{base_name}.csv")))
    if export_img:
        for ext in ["png", "svg"]:
            img_path = os.path.join(export_dir, f"simplex_plot_{base_name}.{ext}")
            if os.path.exists(img_path):
                files.append((f"simplex_plot_{base_name}.{ext}", img_path))
                break
    if export_norm:
        files.append((f"normalized_{base_name}.csv", os.path.join(export_dir, f"normalized_{base_name}.csv")))


    if not files:
        return "No export items selected", 400

    # ✅ 打包为 zip 并发送
    zip_buf = io.BytesIO()
    with zipfile.ZipFile(zip_buf, "w") as zipf:
        for name, path in files:
            if os.path.exists(path):
                zipf.write(path, arcname=name)
            else:
                print(f"⚠️ Missing export file: {path}")
    zip_buf.seek(0)

    return send_file(zip_buf, mimetype="application/zip", as_attachment=True, download_name=f"ecg_export_{base_name}.zip")


if __name__ == '__main__':
    app.run(debug=True)
