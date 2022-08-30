import { compileShader, glsl, Master } from "shader-composer";
import "./style.css";

const ToyMaster = Master({
  name: "ComposerToy Master",
  vertex: {
    header: glsl`attribute vec4 a_position;`,
    body: glsl`
      gl_Position = a_position;
    `,
  },
  fragment: {
    header: glsl`
      uniform vec2 iResolution;
      uniform vec2 iMouse;
      uniform float iTime;

      float smin(in float a, in float b, float k)
      {
          float h = max(k - abs(a-b), 0.0);
          return min(a, b) - h*h/(k * 4.0);
      }
      
      float sphere(in vec3 ray, in vec3 pos, in float radius)
      {
          return length(ray - pos) - radius;    
      }
      
      
      float map(in vec3 ray)
      {
      
          float sphere1 = sphere(ray, vec3(sin(iTime) * 0.2, cos(iTime) * 0.3, sin(iTime) * 0.2), 0.8);
          float sphere2 = sphere(ray, vec3(-sin(iTime), -cos(iTime), cos(iTime)), 0.7);
          float plane = ray.y + 1.1;
          
          float spheres = smin(sphere1, sphere2, 1.8);
          
          float final = smin(plane, spheres, 0.8);
          
          return final;
      }
      
      
      vec3 calcNormal(in vec3 pos)
      {
          vec2 e = vec2(0.0001, 0.0);
      
          return normalize(
              vec3(
                  map(pos + e.xyy) - map(pos-e.xyy),
                  map(pos + e.yxy) - map(pos-e.yxy),
                  map(pos + e.yyx) - map(pos-e.yyx)));
      }
      
      float light(in vec3 normal, in vec3 lightDirection)
      {
          return clamp(dot(normal, lightDirection), 0.0, 1.0);
      }
      
      float fresnel(in vec3 normal, in vec3 viewDirection)
      {
          float factor = 1.0;
          float bias = 0.0;
          float intensity = 0.5;
          float power = 2.0;
          
          float f_a = (factor + dot(viewDirection, normal));
          float f_fresnel = bias + intensity * pow(abs(f_a), power);
          f_fresnel = clamp(f_fresnel, 0.0, 1.0);
          return f_fresnel;
      }
      
      float castRay(in vec3 rayPos, in vec3 rayDir)
      {
          float t = 0.0;
          for (int i = 0; i < 100; i++)
          {
              vec3 pos = rayPos + t * rayDir;
              float h = map(pos);
              if (h < 0.001) break;
              t += h;
              if (t > 20.0) break;
          }
      
          if (t > 20.0) t = -1.0;
      
          return t;
      }
      
      
      void mainImage( out vec4 fragColor, in vec2 fragCoord )
      {
          vec2 p = (2.0 * fragCoord - iResolution.xy)/iResolution.y;
          
          vec3 viewPosition = vec3(0.0, 0.0, 6.0);
          vec3 viewDirection = normalize(vec3(p, -3.5));
      
          vec3 col;
          
          float t = castRay(viewPosition, viewDirection);
      
          if (t > 0.0) {
              vec3 pos = viewPosition + t * viewDirection;
              vec3 normal = calcNormal(pos);
              
              vec3 sunDirection = normalize(vec3(0.8, 0.4, -0.2));
              vec3 skyDirection = vec3(0, 1, 0);
              vec3 albedo = vec3(0.8, 0.3, 0.2);
              
              float sunDiffuse = light(normal, sunDirection);
              float sunShadow = step(castRay(pos + normal * 0.001, sunDirection), 0.0);
      
              float skyDiffuse = light(normal, skyDirection);
              float skyShadow = step(castRay(pos + normal * 0.001, skyDirection), 0.0);
              
              col += albedo * vec3(0.15);
              col += fresnel(normal, viewDirection) * vec3(0.5);
              col += vec3(0.8, 0.5, 0.2) * sunDiffuse * sunShadow;
              col += vec3(0.7, 0.7, 0.8) * skyDiffuse * skyShadow;
          }
          
      
          // gamma
          col = pow(col, vec3(0.4545));
      
          fragColor = vec4(col, 1.0);
      }
      
      `,
    body: glsl`
      mainImage(gl_FragColor, gl_FragCoord.xy);
    `,
  },
});

export function main() {
  // Get A WebGL context
  const canvas = document.querySelector<HTMLCanvasElement>("#canvas")!;
  const gl = canvas.getContext("webgl2");
  if (!gl) {
    return;
  }

  const [shader, meta] = compileShader(ToyMaster);

  // setup GLSL program
  const program = webglUtils.createProgramFromSources(gl, [
    shader.vertexShader,
    shader.fragmentShader,
  ]);

  // look up where the vertex data needs to go.
  const positionAttributeLocation = gl.getAttribLocation(program, "a_position");

  // look up uniform locations
  const resolutionLocation = gl.getUniformLocation(program, "iResolution");
  const mouseLocation = gl.getUniformLocation(program, "iMouse");
  const timeLocation = gl.getUniformLocation(program, "iTime");

  // Create a vertex array object (attribute state)
  const vao = gl.createVertexArray();

  // and make it the one we're currently working with
  gl.bindVertexArray(vao);

  // Create a buffer to put three 2d clip space points in
  const positionBuffer = gl.createBuffer();

  // Bind it to ARRAY_BUFFER (think of it as ARRAY_BUFFER = positionBuffer)
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

  // fill it with a 2 triangles that cover clip space
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([
      -1,
      -1, // first triangle
      1,
      -1,
      -1,
      1,
      -1,
      1, // second triangle
      1,
      -1,
      1,
      1,
    ]),
    gl.STATIC_DRAW
  );

  // Turn on the attribute
  gl.enableVertexAttribArray(positionAttributeLocation);

  // Tell the attribute how to get data out of positionBuffer (ARRAY_BUFFER)
  gl.vertexAttribPointer(
    positionAttributeLocation,
    2, // 2 components per iteration
    gl.FLOAT, // the data is 32bit floats
    false, // don't normalize the data
    0, // 0 = move forward size * sizeof(type) each iteration to get the next position
    0 // start at the beginning of the buffer
  );

  let mouseX = 0;
  let mouseY = 0;

  function setMousePosition(e) {
    const rect = canvas.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = rect.height - (e.clientY - rect.top) - 1; // bottom is 0 in WebGL
  }

  canvas.addEventListener("mousemove", setMousePosition);
  canvas.addEventListener(
    "touchstart",
    (e) => {
      e.preventDefault();
    },
    { passive: false }
  );
  canvas.addEventListener(
    "touchmove",
    (e) => {
      e.preventDefault();
      setMousePosition(e.touches[0]);
    },
    { passive: false }
  );

  function render(time) {
    time *= 0.001; // convert to seconds

    webglUtils.resizeCanvasToDisplaySize(gl.canvas);

    // Tell WebGL how to convert from clip space to pixels
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    // Tell it to use our program (pair of shaders)
    gl.useProgram(program);

    // Bind the attribute/buffer set we want.
    gl.bindVertexArray(vao);

    gl.uniform2f(resolutionLocation, gl.canvas.width, gl.canvas.height);
    gl.uniform2f(mouseLocation, mouseX, mouseY);
    gl.uniform1f(timeLocation, time);

    gl.drawArrays(
      gl.TRIANGLES,
      0, // offset
      6 // num vertices to process
    );

    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
}

main();
