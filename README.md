# Kinetic Monoliths — Three.js WebGPU / WGSL

Escultura cinética minimalista tridimensional interativa renderizada com **Three.js (WebGPURenderer)**, shaders em **WGSL / TSL (Three Shading Language)** e **InstancedMesh**. 

Projetada e calibrada especificamente para rodar com 60 FPS cravados tanto no desktop (**AMD Ryzen 5 4600G / Vega 7**) quanto no celular (**Moto G9 Power / Adreno 610**).

---

## ⚡ Como Rodar o Projeto

### 1. Iniciar o servidor de desenvolvimento:
```bash
npm run dev
```

O terminal exibirá os endereços locais e de rede:
```
  ➜  Local:   http://localhost:5173/
  ➜  Network: http://192.168.x.x:5173/
```

### 2. Acessar no Desktop (Ryzen 5 4600G)
Abra `http://localhost:5173/` no Google Chrome, Microsoft Edge ou Brave.
* O badge no topo indicará **WebGPU (WGSL Ativo)**.

### 3. Acessar no Celular (Moto G9 Power)
Certifique-se de que o celular está conectado na mesma rede Wi-Fi do computador e abra no Chrome do celular:
`http://<seu-ip-local>:5173/` (ex: `http://192.168.1.100:5173`)
* Se o WebGPU estiver ativado no navegador móvel, o WGSL roda nativamente.
* Se for o Chrome padrão estável para Android, a arquitetura TSL executará o fallback transparente para WebGL2 com os mesmos shaders e sem perda de qualidade visual.

---

## 🎮 Controles e Interatividade

* **Orbitar Câmera:** Clique e arraste (ou deslize com 1 dedo no celular).
* **Zoom:** Scroll do mouse (ou pinça com 2 dedos no celular).
* **Ondas de Choque Radiais:** Dê um toque ou clique rápido em qualquer monólito para propagar um pulso ondulatório em tempo real.
* **Giroscópio (Mobile):** Toque no botão **Giroscópio** no rodapé para sincronizar a inclinação da luz de estúdio e reflexos com o acelerômetro do Moto G9 Power.
* **Painel de Parâmetros:** Ajuste velocidade, amplitude, fatores Chebyshev, temas de cores (Obsidian Gold, Pearl Titanium, Emerald Jade, Cyber Violet) e densidade da grade.

---

## 📐 Destaques Técnicos

1. **1 Único Draw Call:** Toda a grade (576 a 1.600 prismas) é despachada para a GPU em uma única chamada usando `InstancedMesh`.
2. **Deslocamento na GPU:** As funções de onda matemáticas são calculadas nos nós de vértice em paralelo na GPU, poupando completamente a CPU do celular (Snapdragon 662).
3. **Resolução Adaptativa (DPR):** Limitado em 1.25x no mobile para respeitar a largura de banda e *fillrate* da GPU Adreno 610 na tela de 720p do Moto G9 Power.
