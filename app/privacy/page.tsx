import Link from "next/link";
import { ArrowLeft } from "lucide-react";

// Standalone, unauthenticated, and NOT under app/(app) — Chrome Web Store
// listings require a linked, publicly-reachable privacy policy URL, and a
// reviewer (or anyone) opening it is very likely on desktop. lib/supabase/
// proxy.ts's device gate has its own exemption for this exact reason (see
// that file's isExemptFromDeviceGate).
export default function PrivacyPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-6 px-6 py-10 text-text">
      <Link href="/" className="flex w-fit items-center gap-2 text-small text-text-muted hover:text-text">
        <ArrowLeft className="size-4" />
        Буцах
      </Link>

      <div className="flex flex-col gap-2">
        <h1 className="text-heading font-semibold text-text">Нууцлалын бодлого</h1>
        <p className="text-small text-text-muted">Сүүлд шинэчилсэн: 2026-08-31</p>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-body font-semibold text-text">Бид юу цуглуулдаг вэ</h2>
        <ul className="flex list-disc flex-col gap-1.5 pl-5 text-small text-text-muted">
          <li>
            <b className="text-text">Акаунтын мэдээлэл</b> — имэйл хаяг (нэвтрэх зорилгоор, Supabase Auth-аар
            удирддаг), кредитийн үлдэгдэл, багц.
          </li>
          <li>
            <b className="text-text">Таны байршуулсан агуулга</b> — 3D загвар үүсгэхийн тулд илгээсэн бүтээгдэхүүний
            зураг, эндээс үүссэн 3D загвар (GLB/USDZ файлууд).
          </li>
          <li>
            <b className="text-text">Chrome extension ашиглаж байгаа бол</b> — зөвхөн таны шууд <b className="text-text">right-click хийж сонгосон</b> тухайн
            зурган (URL болон агуулга)-ы л мэдээллийг илгээдэг. Extension ямар ч үед таны хөтчийн түүх, нээсэн
            хуудсуудыг хянадаггүй, цуглуулдаггүй. Extension-ий эрхийн хамрах хүрээ (host permissions) нь зөвхөн
            таны сонгосон нэг зургийг татах зорилготой — идэвхгүй байхад ямар ч сайт руу автоматаар хандалт
            хийдэггүй.
          </li>
          <li>
            <b className="text-text">Төлбөрийн мэдээлэл</b> — кредит худалдан авахад бид өөрсдөө картын мэдээллийг
            хадгалдаггүй; төлбөрийг манай гуравдагч этгээд төлбөрийн үйлчилгээ үзүүлэгч (wire.mn) шууд
            боловсруулдаг.
          </li>
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-body font-semibold text-text">Гуравдагч этгээдтэй хуваалцах</h2>
        <p className="text-small text-text-muted">
          Таны зургийг 3D загвар болгон хувиргах зорилгоор AI үйлчилгээ үзүүлэгч рүү (Tripo) илгээдэг. Файлууд
          Cloudflare R2 дээр хадгалагддаг. Эдгээр нь зөвхөн бидний үйлчилгээг ажиллуулах зорилготой бөгөөд бид
          таны мэдээллийг зар сурталчилгааны зорилгоор гуравдагч этгээдэд худалддаггүй, түрээслүүлдэггүй.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-body font-semibold text-text">Мэдээллээ устгах</h2>
        <p className="text-small text-text-muted">
          Та өөрийн үүсгэсэн загвар бүрийг хүссэн үедээ Миний Model хэсгээс устгах боломжтой. Chrome extension-ий
          токеныг Тохиргоо хэсгээс хүссэн үедээ цуцалж болно — цуцалсан токен даруй ажиллахаа болино.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-body font-semibold text-text">Холбоо барих</h2>
        <p className="text-small text-text-muted">
          Нууцлалтай холбоотой асуулт байвал бидэнтэй холбогдоно уу:{" "}
          <a href="mailto:zolbayar.d05+realify@gmail.com" className="text-text underline underline-offset-2">
            zolbayar.d05+realify@gmail.com
          </a>
        </p>
      </section>
    </main>
  );
}
