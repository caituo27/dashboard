import { useEffect, useRef } from "react";
import "./AmbientField.css";

const VERTEX_SHADER = `
attribute vec4 a_position;
void main() {
  gl_Position = a_position;
}
`;

// Port of the sprix-data landing background: 3D simplex noise (Ashima) sampled at
// a very low frequency, RGB channels phase-shifted with sin/cos at ~5%
// amplitude so the field stays 95-100% white and slowly morphs color.
const FRAGMENT_SHADER = `
precision highp float;
uniform vec2 u_resolution;
uniform float u_scale;
uniform float time;

vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2 C = vec2(1.0/6.0, 1.0/3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(
      i.z + vec4(0.0, i1.z, i2.z, 1.0))
    + i.y + vec4(0.0, i1.y, i2.y, 1.0))
    + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}

float perlin3(vec3 coord, float x) {
  return x * abs(snoise(coord));
}

void main(void) {
  vec2 uv = gl_FragCoord.xy / vec2(u_scale, u_scale);
  vec3 coord = vec3(uv.xy, -time / 2.0);
  float n = perlin3(coord, 10.0);

  vec3 colors = vec3(
    (1.0 / 255.0) * (255.0 - (255.0 * (1.0 - sin(n + 5.0 * uv.x)) / 20.0)),
    (1.0 / 255.0) * (255.0 - (255.0 * (1.0 - cos(n + 5.0 * uv.x)) / 20.0)),
    (1.0 / 255.0) * (255.0 - (255.0 * (1.0 + sin(n + 5.0 * uv.x)) / 20.0))
  );

  gl_FragColor = vec4(colors.r, colors.g, colors.b, 1.0);
}
`;

// lessie.ai accumulates shader time at 1/3 of wall-clock speed
// (`elapsed_ms / 3000`), which is 1/3 of the original port's pace.
const TIME_SCALE = 1 / 3;

// lessie.ai renders at full devicePixelRatio and divides gl_FragCoord by
// 3000, so the noise frequency (and with it the bright band structure)
// depends on DPR — render the same way instead of downsampling.
const NOISE_SCALE = 3000;

function compileShader(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

/**
 * Replica of the lessie.ai landing background: a fixed WebGL simplex-noise
 * field across the top of the viewport, a linear bottom fade, a radial white
 * veil at the top center, and a scroll-driven white overlay.
 * The loop pauses offscreen, on hidden tabs, once scrolled past the fade,
 * and renders a single static frame for prefers-reduced-motion.
 */
export function AmbientField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fadeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const fade = fadeRef.current;
    if (!canvas || !fade) return;
    const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    if (!(gl instanceof WebGLRenderingContext)) return;

    const vertexShader = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    if (!vertexShader || !fragmentShader) return;
    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
    gl.useProgram(program);

    const positionLocation = gl.getAttribLocation(program, "a_position");
    const resolutionLocation = gl.getUniformLocation(program, "u_resolution");
    const scaleLocation = gl.getUniformLocation(program, "u_scale");
    const timeLocation = gl.getUniformLocation(program, "time");

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    );
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(160, Math.round(rect.width * dpr));
      canvas.height = Math.max(90, Math.round(rect.height * dpr));
      gl.viewport(0, 0, canvas.width, canvas.height);
    };

    const draw = (seconds: number) => {
      gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
      gl.uniform1f(scaleLocation, NOISE_SCALE);
      gl.uniform1f(timeLocation, seconds);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    };

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    let rafId = 0;
    let running = false;
    const loop = (now: number) => {
      draw((now / 1000) * TIME_SCALE);
      rafId = requestAnimationFrame(loop);
    };
    const start = () => {
      if (running || fadedOut || reducedMotion.matches) return;
      running = true;
      rafId = requestAnimationFrame(loop);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(rafId);
    };

    const resizeObserver = new ResizeObserver(() => {
      resize();
      if (!running) draw(0);
    });
    resizeObserver.observe(canvas);

    const intersectionObserver = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) start();
      else stop();
    });
    intersectionObserver.observe(canvas);

    const onVisibilityChange = () => {
      if (document.hidden) stop();
      else start();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    // The field fades out over the first ~20% of viewport scrolling; like
    // lessie.ai, the loop pauses once the fade is fully opaque.
    let scrollRaf = 0;
    let fadedOut = false;
    const applyScrollFade = () => {
      scrollRaf = 0;
      const ratio = Math.min((5 * window.scrollY) / window.innerHeight, 1);
      fade.style.opacity = ratio.toFixed(3);
      fadedOut = ratio >= 1;
      if (fadedOut) stop();
      else start();
    };
    const onScroll = () => {
      if (!scrollRaf) scrollRaf = requestAnimationFrame(applyScrollFade);
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    resize();
    draw(0);
    applyScrollFade();
    start();

    return () => {
      stop();
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("scroll", onScroll);
      if (scrollRaf) cancelAnimationFrame(scrollRaf);
    };
  }, []);

  return (
    <div aria-hidden="true" className="sprix-ambient-field">
      <canvas ref={canvasRef} className="sprix-ambient-canvas" />
      <div className="sprix-ambient-mask" />
      <div className="sprix-ambient-veil" />
      <div ref={fadeRef} className="sprix-ambient-fade" />
    </div>
  );
}
