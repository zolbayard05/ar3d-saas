"use client";

import { useEffect, useRef } from "react";

// A previous version of this component used this repo's own `three` npm
// dependency (0.183) and translated the mockup's r134 API calls to their
// modern equivalents (sRGBEncoding -> colorSpace, etc.). That translation
// kept leaking small behavioral differences one at a time — color
// management alone took three follow-up rounds to track down (blocky
// aliasing, an invisible sofa, then a green cast that only some rotation
// angles exposed) — because every hand-translated line is a fresh place
// for a version-behavior gap to hide. Direct instruction after that: stop
// re-implementing the mockup's renderer against a different library
// version and load its *actual* renderer instead. This does exactly that —
// the same r134 UMD build and OBJLoader build from the same CDN URLs the
// mockup itself uses (`<script>` tags, not the npm package), running the
// mockup's own scene-setup code with zero API translation. Whatever the
// mockup's canvas shows, this canvas shows, by construction — not by
// chasing down each version-behavior gap after the fact.
type LegacyThree = typeof import("three");

let threeLoadPromise: Promise<LegacyThree> | null = null;

function loadLegacyThree(): Promise<LegacyThree> {
  if (threeLoadPromise) return threeLoadPromise;
  threeLoadPromise = new Promise((resolve, reject) => {
    function loadScript(src: string): Promise<void> {
      return new Promise((res, rej) => {
        const existing = document.querySelector(`script[src="${src}"]`);
        if (existing) {
          existing.addEventListener("load", () => res());
          if ((existing as HTMLScriptElement).dataset.loaded === "true") res();
          return;
        }
        const script = document.createElement("script");
        script.src = src;
        script.async = true;
        script.addEventListener("load", () => {
          script.dataset.loaded = "true";
          res();
        });
        script.addEventListener("error", () => rej(new Error("failed to load " + src)));
        document.head.appendChild(script);
      });
    }

    loadScript("https://cdnjs.cloudflare.com/ajax/libs/three.js/r134/three.min.js")
      .then(() => loadScript("https://cdn.jsdelivr.net/npm/three@0.134.0/examples/js/loaders/OBJLoader.js"))
      .then(() => resolve((window as unknown as { THREE: LegacyThree }).THREE))
      .catch(reject);
  });
  return threeLoadPromise;
}

export interface DesktopMockupObjectProps {
  objUrl: string;
  textureUrl: string;
  metalness: number;
  roughness: number;
  className?: string;
  /**
   * "scroll": continuous single-axis turntable tied to an ancestor's
   * scroll range (the hero tumble). "sway": a small idle side-to-side
   * sway, independent of scroll (the mini preview mounts).
   */
  mode: "scroll" | "sway";
  /** Required for mode="scroll" — the element whose scroll range 0..1 drives rotation. */
  progressRef?: React.RefObject<HTMLElement | null>;
  /** Camera position, matching the mockup's per-mount framing. */
  cameraY?: number;
  cameraZ?: number;
}

/**
 * The mockup's own renderer, loaded and run verbatim — see the module-level
 * comment above for why this replaced an npm-three re-implementation. Every
 * THREE.* call below is copied unchanged from realify-landing-v3.html's
 * own `<script>` (scene/camera/lights/envScene/loadObjWithMaterial/
 * mountMiniModel/onScroll), with only the React-lifecycle plumbing
 * (mount/unmount, a scroll listener scoped to progressRef instead of a
 * page-global one, ResizeObserver instead of a window resize listener)
 * added around it.
 */
export function DesktopMockupObject({
  objUrl,
  textureUrl,
  metalness,
  roughness,
  className,
  mode,
  progressRef,
  cameraY = 0.4,
  cameraZ = 5.6,
}: DesktopMockupObjectProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let disposed = false;
    let rafId = 0;
    let cleanupScene: (() => void) | null = null;

    loadLegacyThree().then((THREE) => {
      if (disposed) return;

      const canvas = document.createElement("canvas");
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      canvas.style.display = "block";
      container.appendChild(canvas);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
      camera.position.set(0, cameraY, cameraZ);
      camera.lookAt(0, 0, 0);

      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.35;

      scene.add(new THREE.AmbientLight(0x4a4a40, 0.6));
      const key = new THREE.DirectionalLight(0xfff2df, 1.1);
      key.position.set(-3, 4, 4);
      scene.add(key);
      const rim = new THREE.PointLight(0x9fb894, 1, 20);
      rim.position.set(3, 1, -3);
      scene.add(rim);

      const envScene = new THREE.Scene();
      const envGrad = new THREE.Mesh(
        new THREE.SphereGeometry(40, 32, 32),
        new THREE.ShaderMaterial({
          side: THREE.BackSide,
          uniforms: {
            top: { value: new THREE.Color(0xd8d4c0) },
            bottom: { value: new THREE.Color(0x1c1c18) },
          },
          vertexShader:
            "varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
          fragmentShader:
            "varying vec3 vP; uniform vec3 top; uniform vec3 bottom; void main(){ float h = normalize(vP).y * 0.5 + 0.5; gl_FragColor = vec4(mix(bottom, top, smoothstep(0.1, 0.95, h)), 1.0); }",
        }),
      );
      envScene.add(envGrad);
      [
        { x: -3, y: 2, z: -1.5, w: 8, h: 4, color: 0xffffff },
        { x: 3.5, y: 0.5, z: -2, w: 6, h: 6, color: 0xd8f0c0 },
        { x: -2, y: -3, z: 2, w: 9, h: 3, color: 0xb8b8a8 },
        { x: 2, y: 3, z: 2.5, w: 7, h: 3, color: 0xfff2df },
      ].forEach((p) => {
        const panel = new THREE.Mesh(
          new THREE.PlaneGeometry(p.w, p.h),
          new THREE.MeshBasicMaterial({ color: p.color, side: THREE.DoubleSide }),
        );
        panel.position.set(p.x, p.y, p.z);
        panel.lookAt(0, 0, 0);
        envScene.add(panel);
      });
      const cubeRT = new THREE.WebGLCubeRenderTarget(256);
      const cubeCam = new THREE.CubeCamera(0.1, 100, cubeRT);
      cubeCam.update(renderer, envScene);

      const group = new THREE.Group();
      scene.add(group);

      let miniModel: InstanceType<LegacyThree["Object3D"]> | null = null;
      let miniT = Math.random() * 10;

      function sizeRenderer() {
        if (!container) return;
        const s = container.clientWidth || 1;
        renderer.setSize(s, s, false);
        camera.aspect = 1;
        camera.updateProjectionMatrix();
      }
      function render() {
        renderer.render(scene, camera);
      }

      async function load() {
        const [objText, texture] = await Promise.all([
          fetch(objUrl).then((r) => r.text()),
          new Promise<InstanceType<LegacyThree["Texture"]>>((resolve) => {
            const texLoader = new THREE.TextureLoader();
            texLoader.load(textureUrl, (t) => {
              t.wrapS = t.wrapT = THREE.RepeatWrapping;
              // r134 name for what modern three.js calls texture.colorSpace.
              (t as unknown as { encoding: number }).encoding = (
                THREE as unknown as { sRGBEncoding: number }
              ).sRGBEncoding;
              resolve(t);
            });
          }),
        ]);
        if (disposed) return;

        const material = new THREE.MeshStandardMaterial({
          map: texture,
          metalness,
          roughness,
          envMap: cubeRT.texture,
          envMapIntensity: 1.3,
        });
        // OBJLoader isn't part of core three's type surface (it's a
        // separate examples/jsm module in the npm package whose types
        // we're borrowing) — the legacy examples/js build attaches it to
        // the global THREE namespace directly instead, hence the `any`.
        const objLoaderCtor = (THREE as unknown as { OBJLoader: new () => { parse: (text: string) => InstanceType<LegacyThree["Group"]> } }).OBJLoader;
        const root = new objLoaderCtor().parse(objText);
        root.traverse((child: InstanceType<LegacyThree["Object3D"]>) => {
          const mesh = child as InstanceType<LegacyThree["Mesh"]>;
          if (mesh.isMesh) mesh.material = material;
        });

        const box = new THREE.Box3().setFromObject(root);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const fitScale = 1.9 / Math.max(size.x, size.y, size.z);
        root.scale.setScalar(fitScale);
        root.position.set(-center.x * fitScale, -center.y * fitScale, -center.z * fitScale);

        if (mode === "scroll") {
          group.add(root);
          group.position.y = -0.05;
        } else {
          miniModel = root;
          scene.add(root);
        }
        // Loading is async; the initial synchronous render below can land
        // before this resolves, painting an empty scene that then only
        // gets refreshed by a future scroll tick or rAF frame. Sway mode
        // self-heals next frame regardless, but scroll mode has no source
        // of new frames until the visitor scrolls — force one render now.
        render();
      }
      load();

      function onScroll() {
        const progressEl = progressRef?.current;
        if (!progressEl) return;
        const rect = progressEl.getBoundingClientRect();
        const total = progressEl.offsetHeight - window.innerHeight;
        const p = total > 0 ? Math.min(1, Math.max(0, -rect.top / total)) : 0;
        // Exactly one full turn (2π) over the whole scroll range -- the
        // mockup's original 3.4 multiplier over-rotated to ~1.7 turns
        // (2026-09-02: "just 360 degrees, nothing more").
        group.rotation.y = p * Math.PI * 2;
        render();
      }

      function animateSway() {
        rafId = requestAnimationFrame(animateSway);
        miniT += 0.006;
        if (miniModel) miniModel.rotation.y = Math.sin(miniT) * 0.35 + 0.25;
        render();
      }

      const resizeObserver = new ResizeObserver(() => {
        sizeRenderer();
        render();
      });
      resizeObserver.observe(container);
      sizeRenderer();

      if (mode === "scroll") {
        window.addEventListener("scroll", onScroll, { passive: true });
        onScroll();
      } else {
        animateSway();
      }

      cleanupScene = () => {
        cancelAnimationFrame(rafId);
        window.removeEventListener("scroll", onScroll);
        resizeObserver.disconnect();
        renderer.dispose();
        container.removeChild(canvas);
      };
    });

    return () => {
      disposed = true;
      cleanupScene?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [objUrl, textureUrl, mode]);

  return <div ref={containerRef} className={className} />;
}
