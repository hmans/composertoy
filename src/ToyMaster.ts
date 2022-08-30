import { glsl, Master } from "shader-composer";

export const ToyMaster = () =>
  Master({
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
