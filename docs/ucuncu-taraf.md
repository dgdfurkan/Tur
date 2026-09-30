# Üçüncü Taraf Bileşenler

Bu depodaki özgün kod ve içerik `LICENSE` dosyasındaki koşullara tabidir. Aşağıdaki bileşenler kendi lisanslarıyla kullanılır.

## Çalışma Zamanı Kütüphaneleri

| Bileşen                              | Lisans                                                     | Not                                                                                                          |
| ------------------------------------ | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| [Astro](https://astro.build)         | MIT                                                        | Statik site üretimi                                                                                          |
| [three.js](https://threejs.org)      | MIT                                                        | 3D harita ve simülasyon                                                                                      |
| [GSAP](https://gsap.com)             | [GSAP Standard License](https://gsap.com/standard-license) | Ücretsizdir; açık kaynak lisansı değildir                                                                    |
| [Mediabunny](https://mediabunny.dev) | MPL-2.0                                                    | Video stüdyosunda MP4 dosyasını oluşturur; yalnızca panelde yüklenir. Kaynak kodu değiştirilmeden kullanılır |
| Yazı tipleri                         | SIL Open Font License 1.1                                  | Fontsource paketlerinden alınır, kendi sunucumuzdan sunulur                                                  |

## Harita Verisi

Türkiye ve komşu ülke sınırları, kamu malı olan [Natural Earth](https://www.naturalearthdata.com) verisinden [world-atlas](https://github.com/topojson/world-atlas) (ISC) paketi aracılığıyla üretilir. Üretilen veri `src/features/map3d/data/` altında tutulur.

## Skill Paketleri

`.claude/skills/` altındaki paketler `npx skills add` ile kurulmuştur; kaynak ve sürüm özeti `skills-lock.json` dosyasındadır. Her paket kendi lisansına tabidir.

| Kaynak                                                                                                          | Skill'ler                                                                                                                                              | Lisans                                    |
| --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------- |
| [anthropics/skills](https://github.com/anthropics/skills)                                                       | frontend-design                                                                                                                                        | Apache-2.0 (paket içindeki `LICENSE.txt`) |
| [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills)                                         | web-design-guidelines                                                                                                                                  | MIT (README beyanı)                       |
| [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill)                 | ui-ux-pro-max                                                                                                                                          | MIT                                       |
| [leonxlnx/taste-skill](https://github.com/leonxlnx/taste-skill)                                                 | high-end-visual-design                                                                                                                                 | MIT                                       |
| [emilkowalski/skills](https://github.com/emilkowalski/skills)                                                   | emil-design-eng, animate, review-animations, mobile-native                                                                                             | MIT                                       |
| [greensock/gsap-skills](https://github.com/greensock/gsap-skills)                                               | gsap-core, gsap-timeline, gsap-plugins, gsap-scrolltrigger, gsap-performance, gsap-utils                                                               | MIT                                       |
| [cloudai-x/threejs-skills](https://github.com/cloudai-x/threejs-skills)                                         | threejs-fundamentals, threejs-geometry, threejs-materials, threejs-lighting, threejs-textures, threejs-animation, threejs-interaction, threejs-shaders | MIT (README beyanı)                       |
| [ibelick/ui-skills](https://github.com/ibelick/ui-skills)                                                       | fixing-motion-performance                                                                                                                              | MIT                                       |
| [addyosmani/web-quality-skills](https://github.com/addyosmani/web-quality-skills)                               | web-quality-audit, performance, core-web-vitals, accessibility, seo, best-practices                                                                    | MIT                                       |
| [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills)                                           | security-and-hardening                                                                                                                                 | MIT                                       |
| [getsentry/skills](https://github.com/getsentry/skills)                                                         | security-review                                                                                                                                        | Apache-2.0                                |
| [currents-dev/playwright-best-practices-skill](https://github.com/currents-dev/playwright-best-practices-skill) | playwright-best-practices                                                                                                                              | MIT                                       |

`turkce-icerik-standardi` bu proje için yazılmıştır ve deponun kendi lisansına tabidir.
