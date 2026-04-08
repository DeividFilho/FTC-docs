# 🚀 MetalLab

> **Dashboard de telemetria e inteligência estratégica para competições de robótica.**

O **MetalLab** é o sistema nervoso central da nossa operação robótica. Construído com base na experiência acumulada em arenas competitivas, este dashboard reflete o conhecimento tático e a metodologia STEAM, transformando dados brutos de testes e partidas em inteligência estratégica pura.

Substituindo a tradicional prancheta e caneta por análises em tempo real, o MetalLab acompanha todo o ciclo de vida do robô: desde o design e custos na bancada, até à performance sob pressão na arena.

---

## 🎯 Principais Módulos

* **🎮 Match Tracker:** Registo preciso de pontuações (Autônomo/Tele-op), penalidades (Fouls) e eficiência global. Inclui cálculo de impacto em tempo real.
* **🛠️ DevOps Log:** Um "Engineering Notebook" digital. Permite o registo de commits físicos, documentação de trade-offs de engenharia e evolução de KPIs (Key Performance Indicators) para cada subsistema.
* **📐 Blueprint & BOM:** Gestão automática da lista de materiais (Bill of Materials), custos totais, peso e inspeção de sizing (18"x18"), integrados diretamente com os logs de engenharia.
* **📊 Real-Time Analytics:** Dashboards interativos criados para análise avançada. Monitoriza a consistência (Coeficiente de Variação), média móvel de pontuações, radar de fiabilidade do robô e dispersão de eficácia.
* **⚖️ Compare:** Motor de análise comparativa direta entre diferentes versões e iterações do blueprint do robô.

---

## 💻 Tecnologias Utilizadas

Este projeto foi desenvolvido focado em alta performance e acesso rápido em qualquer dispositivo:

* **Frontend:** HTML5, CSS3 (com suporte nativo a Tema Claro/Escuro) e JavaScript (ES6+).
* **Gráficos:** [Chart.js](https://www.chartjs.org/) para a renderização de dados dinâmicos.
* **Backend / Database:** [Firebase Firestore](https://firebase.google.com/docs/firestore) gerindo a sincronização de dados em tempo real na nuvem (`onSnapshot`).
* **UI/UX:** Ícones via FontAwesome e tipografia otimizada para leitura de dados (JetBrains Mono & Inter).

---
