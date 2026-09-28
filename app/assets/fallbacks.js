"use strict";
(()=>{
/* ============================================================
   Fallback characters — glossy "clay" 3D look via the shared
   #clay SVG filter (defined once in <body>). Replaced by your art.
   ============================================================ */
const face = (cx, cy, s=1) => `
  <g transform="translate(${cx} ${cy}) scale(${s})">
    <ellipse cx="-10" cy="-1" rx="4.6" ry="5.8" fill="#1a1636"/>
    <ellipse cx="10"  cy="-1" rx="4.6" ry="5.8" fill="#1a1636"/>
    <circle cx="-8.4" cy="-3.4" r="1.9" fill="#fff"/><circle cx="11.6" cy="-3.4" r="1.9" fill="#fff"/>
    <circle cx="-11.3" cy="1.6" r=".9" fill="#fff" opacity=".85"/><circle cx="8.7" cy="1.6" r=".9" fill="#fff" opacity=".85"/>
    <ellipse cx="-17.5" cy="7" rx="4.2" ry="2.3" fill="#ff5c8a" opacity=".45"/>
    <ellipse cx="17.5"  cy="7" rx="4.2" ry="2.3" fill="#ff5c8a" opacity=".45"/>
    <path d="M-5.5 5.2h11q0 7.5-5.5 7.5t-5.5-7.5z" fill="#6b1230"/>
    <path d="M-3.4 10.4q3.4-3 6.8 0q-1.6 2.3-3.4 2.3t-3.4-2.3z" fill="#ff7a93"/>
  </g>`;
const grad = (k, stops, x2=0, y2=1) =>
  `<linearGradient id="${k}" x1="0" y1="0" x2="${x2}" y2="${y2}">${stops.map((c,i)=>`<stop offset="${i/(stops.length-1)}" stop-color="${c}"/>`).join("")}</linearGradient>`;

const EMBLEM = {
  lungs:k=>`<svg viewBox="0 0 120 120"><defs>${grad("a"+k,["#e2f5ff","#8fd0ff","#3b7dff"])}${grad("b"+k,["#ffffff","#d6ecff"])}</defs>
    <g filter="url(#clay)">
      <path d="M50 30C31 30 12 56 12 84c0 13 9 21 20 21 10 0 18-5 23-12 3-4 4-9 4-15L56 40c-1-6-2-10-6-10z" fill="url(#a${k})"/>
      <path d="M70 30c19 0 38 26 38 54 0 13-9 21-20 21-10 0-18-5-23-12-3-4-4-9-4-15l3-38c1-6 2-10 6-10z" fill="url(#a${k})"/>
    </g>
    <g filter="url(#clay)">
      <rect x="55" y="6" width="10" height="34" rx="5" fill="url(#b${k})"/>
      <path d="M60 36 45 48" stroke="url(#b${k})" stroke-width="8" stroke-linecap="round"/>
      <path d="M60 36 75 48" stroke="url(#b${k})" stroke-width="8" stroke-linecap="round"/>
    </g>
    <path d="M26 58q-6 10-5 24M94 58q6 10 5 24" stroke="#fff" stroke-width="3" stroke-linecap="round" fill="none" opacity=".5"/>
    ${face(60,82,.9)}</svg>`,

  stomach:k=>`<svg viewBox="0 0 120 120"><defs>${grad("a"+k,["#ffd6de","#ff8aa2","#f0456a"])}${grad("b"+k,["#ffc4cf","#ff8aa2"])}</defs>
    <g filter="url(#clay)">
      <path d="M36 4h16v24c0 6 4 8 9 4 5-5 11-8 19-8 17 0 28 14 28 32 0 32-25 54-56 54-24 0-41-16-41-37 0-15 8-27 21-34 3-2 4-5 4-9z" fill="url(#a${k})"/>
      <path d="M36 4h16v18H36z" fill="url(#b${k})"/>
    </g>
    <path d="M78 36q14 2 18 16" stroke="#fff" stroke-width="3.2" stroke-linecap="round" fill="none" opacity=".5"/>
    ${face(56,74,1.1)}</svg>`,

  microbe:k=>{
    const A=[0,40,80,120,160,200,240,280,320], r=Math.PI/180;
    return `<svg viewBox="0 0 120 120"><defs>${grad("a"+k,["#d8ffe9","#62ee9e","#12b36a"])}</defs>
    <g filter="url(#clay)">
      ${A.map(a=>`<path d="M${60+30*Math.cos(a*r)} ${60+30*Math.sin(a*r)}L${60+47*Math.cos(a*r)} ${60+47*Math.sin(a*r)}" stroke="#3fd98a" stroke-width="7" stroke-linecap="round"/>`).join("")}
      ${A.map(a=>`<circle cx="${60+50*Math.cos(a*r)}" cy="${60+50*Math.sin(a*r)}" r="7" fill="url(#a${k})"/>`).join("")}
      <circle cx="60" cy="60" r="36" fill="url(#a${k})"/>
    </g>
    <circle cx="44" cy="44" r="4" fill="#fff" opacity=".35"/><circle cx="80" cy="76" r="3" fill="#0a7a45" opacity=".25"/><circle cx="42" cy="78" r="2.4" fill="#0a7a45" opacity=".25"/>
    ${face(60,62,1.15)}</svg>`},

  pill:k=>`<svg viewBox="0 0 120 120"><defs>${grad("a"+k,["#ff9d8f","#ff3d4f","#c8102e"])}${grad("b"+k,["#ffffff","#f1f4ff","#c8d0ea"])}</defs>
    <g transform="rotate(-35 60 60)" filter="url(#clay)">
      <path d="M60 34H38a26 26 0 0 0 0 52h22z" fill="url(#a${k})"/>
      <path d="M60 34h22a26 26 0 0 1 0 52H60z" fill="url(#b${k})"/>
    </g>
    <g transform="rotate(-35 60 60)"><path d="M24 46q8-6 20-6" stroke="#fff" stroke-width="3.5" stroke-linecap="round" fill="none" opacity=".6"/></g>
    ${face(60,62,.95)}</svg>`,

  heart:k=>`<svg viewBox="0 0 120 120"><defs>${grad("a"+k,["#ffc1cc","#ff5577","#d81644"])}</defs>
    <g filter="url(#clay)"><path d="M60 106S12 80 12 44a25 25 0 0 1 48-10 25 25 0 0 1 48 10c0 36-48 62-48 62z" fill="url(#a${k})"/></g>
    <path d="M28 30q-8 6-8 18" stroke="#fff" stroke-width="3.5" stroke-linecap="round" fill="none" opacity=".55"/>
    ${face(60,58,1.2)}</svg>`,

  brain:k=>`<svg viewBox="0 0 120 120"><defs>${grad("a"+k,["#ffe0fb","#ff9ee8","#c95cf0"])}</defs>
    <g filter="url(#clay)"><path d="M60 20c-7-8-24-7-28 4-13 0-21 12-15 22-11 7-9 24 3 28-1 13 12 22 24 18 6 9 16 8 16-2 0 10 10 11 16 2 12 4 25-5 24-18 12-4 14-21 3-28 6-10-2-22-15-22-4-11-21-12-28-4z" fill="url(#a${k})"/></g>
    <path d="M60 24v10M38 36q8 2 9 10M82 36q-8 2-9 10M24 62q8-3 13 3M96 62q-8-3-13 3" stroke="#b0409c" stroke-width="2.6" fill="none" stroke-linecap="round" opacity=".45"/>
    ${face(60,66,1.05)}</svg>`,
};
EMBLEM.surgery = EMBLEM.pill;
EMBLEM.radiology = EMBLEM.lungs;
EMBLEM.pediatrics = EMBLEM.heart;
EMBLEM.dermatology = EMBLEM.pill;
EMBLEM.psychiatry = EMBLEM.brain;
EMBLEM.orthopedics = EMBLEM.stomach;
EMBLEM.obgyn = EMBLEM.heart;
EMBLEM.emergency = EMBLEM.heart;
EMBLEM.anesthesia = EMBLEM.lungs;


window.KAFU_EMBLEM=EMBLEM;
})();
