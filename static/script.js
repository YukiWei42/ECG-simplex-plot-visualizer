let baseName1 = ""; 
let baseName2 = ""; 
let hasUploadedA = false;
let hasUploadedB = false;

function uploadFile2() {
    const file = document.getElementById("fileInput2").files[0];
    const lead = document.getElementById("lead2").value;

    const progressBar = document.getElementById("progressBar2");
    const progressLabel = document.getElementById("progressLabel2");
    const progressContainer = document.getElementById("progressContainer2");

    if (!file) {
        alert("Please select a file.");
        return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("lead", lead);

    progressBar.value = 10;
    progressLabel.textContent = "Uploading...";
    progressContainer.style.display = "flex";

    fetch("/process", {
        method: "POST",
        body: formData,
    })
    .then((res) => {
        if (!res.ok) throw new Error("Upload failed");
        progressBar.value = 60;
        progressLabel.textContent = "Plotting...";
        return res.json();
    })
    .then((data) => {
        const color = document.getElementById("colorPicker2").value;
        drawSimplexPlot(data.normalized, "plot2", color);
        baseName2 = data.basename;
        hasUploadedB = true;
        progressBar.value = 100;
        progressLabel.textContent = "Done!";
        setTimeout(() => {
            progressContainer.style.display = "none";
        }, 1000);
    })
    .catch((err) => {
        progressLabel.textContent = "Error: " + err.message;
        setTimeout(() => {
            progressContainer.style.display = "none";
        }, 3000);
    });
}

function drawSimplexPlot(data, targetId, color = "steelblue") {
    const container = d3.select("#" + targetId);
    container.selectAll("*").remove();

    const width = 500, height = 450, margin = 60;
    const svg = container.append("svg")
        .attr("width", width)
        .attr("height", height);

    const A = [width / 2, margin];
    const B = [margin, height - margin];
    const C = [width - margin, height - margin];

    svg.append("polygon")
        .attr("points", [A, B, C].map(d => d.join(",")).join(" "))
        .attr("stroke", "black")
        .attr("fill", "none");

    function lerp(p1, p2, t) {
        return [(1 - t) * p1[0] + t * p2[0], (1 - t) * p1[1] + t * p2[1]];
    }

    for (let i = 1; i < 10; i++) {
        const t = i / 10;
        const lines = [
            [lerp(A, B, t), lerp(A, C, t)],
            [lerp(B, A, t), lerp(B, C, t)],
            [lerp(C, A, t), lerp(C, B, t)]
        ];
        lines.forEach(([p1, p2]) => {
            svg.append("line")
                .attr("x1", p1[0]).attr("y1", p1[1])
                .attr("x2", p2[0]).attr("y2", p2[1])
                .attr("stroke", "#ccc")
                .attr("stroke-dasharray", "4");
        });
    }

    //刻度
    for (let i = 1; i < 10; i++) {
        const t = i / 10;
        const label = t.toFixed(1);

        const ab = lerp(A, B, t);
        svg.append("text")
            .attr("x", ab[0] - 18)
            .attr("y", ab[1] - 4)
            .text(label)
            .attr("font-size", "10px");

        const bc = lerp(B, C, t);
        svg.append("text")
            .attr("x", bc[0])
            .attr("y", bc[1] + 15)
            .text(label)
            .attr("font-size", "10px");

        const ca = lerp(C, A, t);
        svg.append("text")
            .attr("x", ca[0] + 5)
            .attr("y", ca[1] - 5)
            .text(label)
            .attr("font-size", "10px");
    }

    function barycentricToCartesian(a, b, c) {
        return [a * A[0] + b * B[0] + c * C[0], a * A[1] + b * B[1] + c * C[1]];
    }

    
    //plot points
    const delay = 10;  //ms

    data.forEach((d, i) => {
    const [x, y] = barycentricToCartesian(d[0], d[1], d[2]);
    setTimeout(() => {
        svg.append("circle")
            .attr("class", "simplex-point")    
            .attr("cx", x)
            .attr("cy", y)
            .attr("r", 0)
            .attr("fill", color)
            .transition()
            .duration(100)
            .attr("r", 3);  // 由 0 动画放大到正常尺寸
    }, i * delay);
    });

    // Tooltip文本元素
    const tooltip = svg.append("text")
        .attr("id", "tooltip")
        .attr("font-size", "12px")
        .attr("fill", "white")               // 白色字体
        .style("stroke", "black")            // 黑色描边
        .style("stroke-width", "0.5px")
        .style("visibility", "hidden");

    // 用于捕捉鼠标事件的透明层
    svg.append("rect")
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", width)
        .attr("height", height)
        .attr("fill", "transparent")
    svg.on("mousemove", function (event) {
        const [x, y] = d3.pointer(event, this);

        // 计算 barycentric 坐标
        const [a, b, c] = cartesianToBarycentric(x, y, A, B, C);

        if (a >= 0 && b >= 0 && c >= 0 && a <= 1 && b <= 1 && c <= 1) {
            tooltip
                .attr("x", x + 10)
                .attr("y", y - 10)
                .text(`(${a.toFixed(2)}, ${b.toFixed(2)}, ${c.toFixed(2)})`)
                .style("visibility", "visible");
        } else {
            tooltip.style("visibility", "hidden");
        }
    })
    svg.on("mouseout", () => {
        tooltip.style("visibility", "hidden");
    });

    tooltip.raise();

}

async function handleExport(side) {
    const isA = side === "A";

    const exportR = document.getElementById(`exportRpeaks${side}`).checked;
    const exportRR = document.getElementById(`exportRR${side}`).checked;
    const exportImg = document.getElementById(`exportImage${side}`).checked;
    const exportNorm = document.getElementById(`exportNorm${side}`).checked;
    const format = document.getElementById(`imageFormat${side}`).value;

    const baseName = isA ? baseName1 : baseName2;
    const hasUploaded = isA ? hasUploadedA : hasUploadedB;
    const svgSelector = isA ? "#plot svg" : "#plot2 svg";

    if (!hasUploaded || !baseName) {
        alert(`Please upload ECG data for side ${side} first.`);
        return;
    }

    if (!exportR && !exportRR && !exportNorm && !exportImg) {
        alert("Please select at least one item to export.");
        return;
    }

    if (exportImg) {
        try {
            const svg = document.querySelector(svgSelector);
            const filename = `simplex_plot_${baseName}.${format}`;
            await uploadImage(svg, filename, format);
        } catch (err) {
            alert("Image upload failed: " + err.message);
            return;
        }
    }

    const params = new URLSearchParams();
    params.append("basename", baseName);
    if (exportR) params.append("rpeaks", "1");
    if (exportRR) params.append("rr", "1");
    if (exportNorm) params.append("norm", "1");
    if (exportImg) params.append("img", "1");

    window.open("/export?" + params.toString(), "_blank");
}


function uploadImage(svgElement, filename, format = "svg") {
    const svgData = new XMLSerializer().serializeToString(svgElement);

    if (format === "svg") {
        // SVG 直接上传
        const formData = new FormData();
        formData.append("image", new Blob([svgData], { type: "image/svg+xml" }));
        formData.append("filename", filename);
        return fetch("/upload_image", {
            method: "POST",
            body: formData,
        });
    } else if (format === "png") {
        // PNG 转换
        return new Promise((resolve, reject) => {
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");

            const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
            const url = URL.createObjectURL(svgBlob);

            const img = new Image();
            img.crossOrigin = "anonymous";
            
            img.onload = function () {
                canvas.width = svgElement.clientWidth;
                canvas.height = svgElement.clientHeight;
                ctx.fillStyle = "white";
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0);

                canvas.toBlob(function (blob) {
                    const formData = new FormData();
                    formData.append("image", blob);
                    formData.append("filename", filename);
                    fetch("/upload_image", {
                        method: "POST",
                        body: formData,
                    })
                    .then(res => {
                        if (!res.ok) throw new Error("Upload failed");
                        resolve();  // ✅ only resolve when upload is successful
                    })
                    .catch(reject);
                }, "image/png");

                URL.revokeObjectURL(url);
            };
            img.onerror = reject;
            img.src = url;
        });
    }
}


function downloadPlot(plotId, filename) {
    const svg = document.querySelector(`#${plotId} svg`);
    const svgData = new XMLSerializer().serializeToString(svg);

    const format = filename.endsWith(".svg") ? "svg" : "png";
    if (format === "svg") {
        const blob = new Blob([svgData], { type: "image/svg+xml" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } else {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        canvas.width = svg.width.baseVal.value;
        canvas.height = svg.height.baseVal.value;

        const img = new Image();
        const url = URL.createObjectURL(new Blob([svgData], { type: "image/svg+xml;charset=utf-8" }));
        img.onload = () => {
            ctx.fillStyle = "white";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);
            URL.revokeObjectURL(url);

            const pngUrl = canvas.toDataURL("image/png");
            const link = document.createElement("a");
            link.download = filename;
            link.href = pngUrl;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        };
        img.src = url;
    }
}

function cartesianToBarycentric(x, y, A, B, C) {
    const [x1, y1] = A;
    const [x2, y2] = B;
    const [x3, y3] = C;

    const detT = (y2 - y3)*(x1 - x3) + (x3 - x2)*(y1 - y3);

    const a = ((y2 - y3)*(x - x3) + (x3 - x2)*(y - y3)) / detT;
    const b = ((y3 - y1)*(x - x3) + (x1 - x3)*(y - y3)) / detT;
    const c = 1 - a - b;

    return [a, b, c];
}
