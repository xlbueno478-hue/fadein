// vite.config.js — adicione/substitua o seu existente
//
// Antes: instale o plugin PWA
//   npm install -D vite-plugin-pwa
//
// Depois: copie este arquivo pra raiz do projeto (mesmo nível do package.json).

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // 'autoUpdate' = quando subir versão nova no Vercel, todos os usuários
      // recebem em background na próxima vez que abrirem o app, sem F5.
      registerType: "autoUpdate",

      // Inclui assets estáticos no precache (SW serve esses arquivos offline)
      includeAssets: [
        "favicon-32.png",
        "apple-touch-icon.png",
        "icon-192.png",
        "icon-512.png",
        "icon-maskable-512.png",
      ],

      // Manifest do PWA — o que define como o app aparece quando instalado.
      manifest: {
        name: "Fadein — Gestão para Barbearias",
        short_name: "Fadein", // nome curto que aparece embaixo do ícone na home
        description: "Sistema de gestão para barbearias — agenda, link de agendamento, comissões e financeiro.",

        // Cores do tema (devem bater com o C.bg do app pra transição suave do splash)
        theme_color: "#1A1A1A",
        background_color: "#1A1A1A",

        // standalone = abre fullscreen, sem barra do navegador
        display: "standalone",
        orientation: "portrait",

        // Onde o app abre quando o usuário toca no ícone
        start_url: "/",
        scope: "/",

        // pt-BR pra acentuação correta nas notificações
        lang: "pt-BR",

        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          // Maskable: Android usa pra "adaptive icons" — pode cortar bordas
          { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],

        // Opcional: mostra os atalhos quando o usuário pressiona o ícone do app
        shortcuts: [
          {
            name: "Agenda de hoje",
            short_name: "Agenda",
            description: "Abrir a agenda do dia",
            url: "/?page=agenda",
            icons: [{ src: "/icon-192.png", sizes: "192x192" }],
          },
          {
            name: "Link de agendamento",
            short_name: "Link",
            description: "Compartilhar o link público",
            url: "/?page=link",
            icons: [{ src: "/icon-192.png", sizes: "192x192" }],
          },
        ],
      },

      // Workbox = service worker. Estratégias de cache por tipo de recurso.
      workbox: {
        // Pré-cacheia tudo do build (assets estáticos + JS/CSS)
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff,woff2}"],

        // Cache em runtime: chamadas Supabase usam NetworkFirst com fallback rápido.
        // Isso significa: tenta a internet primeiro, se demorar mais que 4s usa cache.
        // Bom porque mantém os dados frescos quando há rede, mas não trava se cair.
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.hostname.endsWith(".supabase.co"),
            handler: "NetworkFirst",
            options: {
              cacheName: "supabase-api",
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 60, maxAgeSeconds: 60 * 5 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Fontes do Google (caso adicione no futuro)
            urlPattern: ({ url }) => url.origin === "https://fonts.googleapis.com" || url.origin === "https://fonts.gstatic.com",
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts",
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],

        // Quando tem update novo, troca imediatamente (em vez de esperar todas as
        // abas fecharem). Como o auto-update está ativo, os usuários sempre
        // pegam a versão mais nova rapidamente.
        skipWaiting: true,
        clientsClaim: true,
      },

      // Em desenvolvimento, ativa o SW também — útil pra testar instalação no localhost.
      // Comente se preferir SW só em produção.
      devOptions: {
        enabled: false, // mude pra true se quiser testar localmente
      },
    }),
  ],
});