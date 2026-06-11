// Aurora 极光背景效果 - 移植自 react-bits Aurora 组件
// 使用纯 WebGL2 实现，无外部依赖

(function () {
    'use strict';

    function hexToRgb(hex) {
        var h = hex.replace('#', '');
        return [
            parseInt(h.slice(0, 2), 16) / 255,
            parseInt(h.slice(2, 4), 16) / 255,
            parseInt(h.slice(4, 6), 16) / 255
        ];
    }

    var vertSrc = '#version 300 es\n' +
        'in vec2 position;\n' +
        'void main() {\n' +
        '  gl_Position = vec4(position, 0.0, 1.0);\n' +
        '}\n';

    var fragSrc = '#version 300 es\n' +
        'precision highp float;\n' +
        '\n' +
        'uniform float uTime;\n' +
        'uniform float uAmplitude;\n' +
        'uniform vec3 uColorStops[3];\n' +
        'uniform vec2 uResolution;\n' +
        'uniform float uBlend;\n' +
        '\n' +
        'out vec4 fragColor;\n' +
        '\n' +
        'vec3 permute(vec3 x) {\n' +
        '  return mod(((x * 34.0) + 1.0) * x, 289.0);\n' +
        '}\n' +
        '\n' +
        'float snoise(vec2 v) {\n' +
        '  const vec4 C = vec4(\n' +
        '      0.211324865405187, 0.366025403784439,\n' +
        '      -0.577350269189626, 0.024390243902439\n' +
        '  );\n' +
        '  vec2 i = floor(v + dot(v, C.yy));\n' +
        '  vec2 x0 = v - i + dot(i, C.xx);\n' +
        '  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);\n' +
        '  vec4 x12 = x0.xyxy + C.xxzz;\n' +
        '  x12.xy -= i1;\n' +
        '  i = mod(i, 289.0);\n' +
        '\n' +
        '  vec3 p = permute(\n' +
        '      permute(i.y + vec3(0.0, i1.y, 1.0))\n' +
        '    + i.x + vec3(0.0, i1.x, 1.0)\n' +
        '  );\n' +
        '\n' +
        '  vec3 m = max(\n' +
        '      0.5 - vec3(\n' +
        '          dot(x0, x0),\n' +
        '          dot(x12.xy, x12.xy),\n' +
        '          dot(x12.zw, x12.zw)\n' +
        '      ),\n' +
        '      0.0\n' +
        '  );\n' +
        '  m = m * m;\n' +
        '  m = m * m;\n' +
        '\n' +
        '  vec3 x = 2.0 * fract(p * C.www) - 1.0;\n' +
        '  vec3 h = abs(x) - 0.5;\n' +
        '  vec3 ox = floor(x + 0.5);\n' +
        '  vec3 a0 = x - ox;\n' +
        '  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);\n' +
        '\n' +
        '  vec3 g;\n' +
        '  g.x = a0.x * x0.x + h.x * x0.y;\n' +
        '  g.yz = a0.yz * x12.xz + h.yz * x12.yw;\n' +
        '  return 130.0 * dot(m, g);\n' +
        '}\n' +
        '\n' +
        'struct ColorStop {\n' +
        '  vec3 color;\n' +
        '  float position;\n' +
        '};\n' +
        '\n' +
        '#define COLOR_RAMP(colors, factor, finalColor) { \\\n' +
        '  int index = 0; \\\n' +
        '  for (int i = 0; i < 2; i++) { \\\n' +
        '     ColorStop currentColor = colors[i]; \\\n' +
        '     bool isInBetween = currentColor.position <= factor; \\\n' +
        '     index = int(mix(float(index), float(i), float(isInBetween))); \\\n' +
        '  } \\\n' +
        '  ColorStop currentColor = colors[index]; \\\n' +
        '  ColorStop nextColor = colors[index + 1]; \\\n' +
        '  float range = nextColor.position - currentColor.position; \\\n' +
        '  float lerpFactor = (factor - currentColor.position) / range; \\\n' +
        '  finalColor = mix(currentColor.color, nextColor.color, lerpFactor); \\\n' +
        '}\n' +
        '\n' +
        'void main() {\n' +
        '  vec2 uv = gl_FragCoord.xy / uResolution;\n' +
        '\n' +
        '  ColorStop colors[3];\n' +
        '  colors[0] = ColorStop(uColorStops[0], 0.0);\n' +
        '  colors[1] = ColorStop(uColorStops[1], 0.5);\n' +
        '  colors[2] = ColorStop(uColorStops[2], 1.0);\n' +
        '\n' +
        '  vec3 rampColor;\n' +
        '  COLOR_RAMP(colors, uv.x, rampColor);\n' +
        '\n' +
        '  float curveOffset = snoise(vec2(uv.x * 1.0 + uTime * 0.04, uTime * 0.06));\n' +
        '  float curveOffset2 = snoise(vec2(uv.x * 0.6 - uTime * 0.03, uTime * 0.08 + 10.0)) * 0.5;\n' +
        '  float centerY = 0.5 + (curveOffset + curveOffset2) * 0.3;\n' +
        '\n' +
        '  float distToCurve = uv.y - centerY;\n' +
        '\n' +
        '  float widthNoise = snoise(vec2(uv.x * 2.0 + uTime * 0.02, uTime * 0.03)) * 0.08;\n' +
        '  float pulse = sin(uTime * 0.15) * 0.04;\n' +
        '  float halfWidth = 0.22 + widthNoise + pulse;\n' +
        '  halfWidth = max(halfWidth, 0.06);\n' +
        '\n' +
        '  float distNorm = abs(distToCurve) / halfWidth;\n' +
        '  float bandMask = 1.0 - smoothstep(0.0, 1.0, distNorm);\n' +
        '\n' +
        '  float detail = snoise(vec2(uv.x * 3.0 + uTime * 0.08, uv.y * 2.0 + uTime * 0.05)) * 0.4 + 0.6;\n' +
        '\n' +
        '  float verticalGrad = (1.0 - distNorm) * 0.5 + 0.5;\n' +
        '\n' +
        '  float intensity = bandMask * detail * verticalGrad * uAmplitude;\n' +
        '  intensity = max(intensity, 0.0);\n' +
        '\n' +
        '  vec3 bandColor = mix(rampColor, uColorStops[1], distNorm * 0.3);\n' +
        '\n' +
        '  float alpha = intensity * uBlend;\n' +
        '  alpha = clamp(alpha, 0.0, 1.0);\n' +
        '\n' +
        '  vec3 finalColor = bandColor * 1.2;\n' +
        '  fragColor = vec4(finalColor * alpha, alpha);\n' +
        '}\n';

    var resizeObserver = null;

    function AuroraBg(options) {
        this.container = options.container || document.body;
        this.colorStops = options.colorStops || ['#3A29FF', '#FF94B4', '#FFD700'];
        this.amplitude = options.amplitude != null ? options.amplitude : 0.6;
        this.blend = options.blend != null ? options.blend : 0.7;
        this.speed = options.speed != null ? options.speed : 0.6;
        this.opacity = options.opacity != null ? options.opacity : 0.3;

        this.canvas = null;
        this.gl = null;
        this.program = null;
        this.vao = null;
        this.animId = null;
        this.startTime = 0;
        this.running = false;
        this.boundResize = this._resize.bind(this);

        this._init();
    }

    AuroraBg.prototype._createShader = function (type, source) {
        var gl = this.gl;
        var shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error('Aurora shader compile error:', gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);
            return null;
        }
        return shader;
    };

    AuroraBg.prototype._createProgram = function (vertSrc, fragSrc) {
        var gl = this.gl;
        var vert = this._createShader(gl.VERTEX_SHADER, vertSrc);
        var frag = this._createShader(gl.FRAGMENT_SHADER, fragSrc);
        if (!vert || !frag) return null;
        var program = gl.createProgram();
        gl.attachShader(program, vert);
        gl.attachShader(program, frag);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.error('Aurora program link error:', gl.getProgramInfoLog(program));
            return null;
        }
        return program;
    };

    AuroraBg.prototype._init = function () {
        try {
            this.canvas = document.createElement('canvas');
            this.canvas.className = 'aurora-canvas';
            this.canvas.style.position = 'absolute';
            this.canvas.style.top = '0';
            this.canvas.style.left = '0';
            this.canvas.style.pointerEvents = 'none';

            this.gl = this.canvas.getContext('webgl2', {
                alpha: true,
                premultipliedAlpha: true,
                antialias: true
            });

            if (!this.gl) {
                console.warn('[Aurora] WebGL2 not supported');
                return;
            }

            var gl = this.gl;
            gl.clearColor(0, 0, 0, 0);
            gl.enable(gl.BLEND);
            gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

            this.program = this._createProgram(vertSrc, fragSrc);
            if (!this.program) return;

            gl.useProgram(this.program);

            var vertices = new Float32Array([-1, -1, 3, -1, -1, 3]);
            this.vao = gl.createVertexArray();
            gl.bindVertexArray(this.vao);
            var vbo = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
            gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
            gl.enableVertexAttribArray(0);
            gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

            this._setUniforms();

            var pos = window.getComputedStyle(this.container).position;
            if (pos !== 'relative' && pos !== 'absolute' && pos !== 'fixed') {
                this.container.style.position = 'relative';
            }
            this.container.insertBefore(this.canvas, this.container.firstChild);

            this._resize();
            this.startTime = performance.now();
            this.running = true;
            this._tick();
        } catch (e) {
            console.warn('[Aurora] Init failed:', e);
        }
    };

    AuroraBg.prototype._setUniforms = function () {
        var gl = this.gl;
        var program = this.program;
        if (!program) return;

        var colors = this.colorStops.map(hexToRgb);
        var flat = new Float32Array(colors.flat());
        var colorLoc = gl.getUniformLocation(program, 'uColorStops');
        if (colorLoc) gl.uniform3fv(colorLoc, flat);

        var ampLoc = gl.getUniformLocation(program, 'uAmplitude');
        if (ampLoc) gl.uniform1f(ampLoc, this.amplitude);

        var blendLoc = gl.getUniformLocation(program, 'uBlend');
        if (blendLoc) gl.uniform1f(blendLoc, this.blend);
    };

    AuroraBg.prototype._resize = function () {
        if (!this.canvas || !this.gl) return;
        var rect = this.container.getBoundingClientRect();
        var dpr = Math.min(devicePixelRatio || 1, 2);
        var w = Math.round(rect.width * dpr);
        var h = Math.round(rect.height * dpr);
        if (this.canvas.width !== w || this.canvas.height !== h) {
            this.canvas.width = w;
            this.canvas.height = h;
            this.canvas.style.width = rect.width + 'px';
            this.canvas.style.height = rect.height + 'px';
            if (this.program) {
                var gl = this.gl;
                gl.useProgram(this.program);
                var resLoc = gl.getUniformLocation(this.program, 'uResolution');
                if (resLoc) gl.uniform2f(resLoc, w, h);
            }
            this.gl.viewport(0, 0, w, h);
        }
    };

    AuroraBg.prototype._tick = function () {
        if (!this.running) return;
        this.animId = requestAnimationFrame(this._tick.bind(this));
        this._render();
    };

    AuroraBg.prototype._render = function () {
        var gl = this.gl;
        var program = this.program;
        if (!gl || !program) return;

        gl.useProgram(program);

        var elapsed = (performance.now() - this.startTime) * 0.001 * this.speed;
        var timeLoc = gl.getUniformLocation(program, 'uTime');
        if (timeLoc) gl.uniform1f(timeLoc, elapsed);

        gl.bindVertexArray(this.vao);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    AuroraBg.prototype.destroy = function () {
        this.running = false;
        if (this.animId) {
            cancelAnimationFrame(this.animId);
            this.animId = null;
        }
        if (this.gl && this.program) {
            this.gl.getExtension('WEBGL_lose_context').loseContext();
        }
        if (this.canvas && this.canvas.parentNode) {
            this.canvas.parentNode.removeChild(this.canvas);
        }
        this.canvas = null;
        this.gl = null;
        this.program = null;
        this.vao = null;
    };

    function initAurora(options) {
        var opts = options || {};
        var selectors = opts.selector || '.aurora-bg';
        var containers = document.querySelectorAll(selectors);
        if (containers.length === 0 && opts.fallback) {
            containers = [opts.fallback];
        }
        var instances = [];
        containers.forEach(function (container) {
            var inst = new AuroraBg({
                container: container,
                colorStops: opts.colorStops || undefined,
                amplitude: opts.amplitude,
                blend: opts.blend,
                speed: opts.speed
            });
            instances.push(inst);
        });
        return instances;
    }

    window.AuroraBg = AuroraBg;
    window.initAurora = initAurora;

})();
