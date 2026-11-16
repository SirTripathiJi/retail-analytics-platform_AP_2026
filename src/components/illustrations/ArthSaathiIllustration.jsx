const palette = {
  ink: '#29251f', paper: '#f5eddf', paperDark: '#e9ddc9', coral: '#d85c4e', coralLight: '#f3b5a0',
  mustard: '#dfa94f', green: '#617b61', greenLight: '#b8c8a6', blue: '#7798a2', blueLight: '#c4d7d5',
  skin: '#bd805f', skinLight: '#d89c78', hair: '#352a27', shirt: '#e8d6ad', apron: '#697d63', wood: '#a66d4b',
}

function Shopkeeper({ x = 0, y = 0, scale = 1, action = 'ledger', facing = 'front' }) {
  return <g transform={`translate(${x} ${y}) scale(${scale})`} stroke={palette.ink} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
    <ellipse cx="102" cy="291" rx="67" ry="12" fill="#45352b" opacity=".12" stroke="none" />
    <path d="M47 174 Q51 146 75 140 L128 140 Q153 149 160 178 L176 282 L30 282 Z" fill={palette.shirt} />
    <path d="M74 144 L101 164 L128 143 L148 158 L135 188 L143 280 L59 280 L69 189 L53 160 Z" fill={palette.apron} />
    <path d="M75 145 Q99 178 128 145 M71 181 L59 280 M131 182 L143 280" fill="none" />
    <path d="M82 180 L126 180 L131 223 Q106 235 77 223 Z" fill="#8b9877" />
    <path d="M105 188 L106 207" stroke={palette.coral} strokeWidth="4" />
    <path d="M52 164 Q33 191 36 228 L61 234 L79 191 M149 164 Q167 184 161 211" fill={palette.shirt} />
    <path d={action === 'greet' ? 'M160 205 Q177 181 192 167' : 'M38 215 Q25 239 46 251'} fill="none" stroke={palette.skin} strokeWidth="14" />
    <path d={action === 'greet' ? 'M190 167 l7 -10 M190 167 l10 1' : 'M46 250 q8 5 14 -1'} fill="none" stroke={palette.skin} strokeWidth="7" />
    <path d="M72 136 Q73 117 68 104 L142 104 Q136 124 143 144 Q108 163 72 136Z" fill={palette.skinLight} />
    <path d="M65 89 Q64 48 103 46 Q144 47 148 90 L140 121 Q129 143 106 143 Q82 141 72 120 Z" fill={palette.skinLight} />
    <path d="M65 89 Q56 60 80 43 Q111 24 139 45 Q159 61 147 95 Q137 77 126 67 Q103 82 75 78 Z" fill={palette.hair} />
    <path d="M130 48 Q151 41 157 56 Q162 71 147 79" fill={palette.hair} />
    <path d="M77 91 Q88 84 97 90 M118 90 Q129 84 138 90" fill="none" strokeWidth="4" />
    <ellipse cx="88" cy="101" rx="3.4" ry="4.5" fill={palette.ink} stroke="none" />
    <ellipse cx="126" cy="101" rx="3.4" ry="4.5" fill={palette.ink} stroke="none" />
    <path d="M105 99 Q98 117 107 119" fill="none" strokeWidth="2.6" />
    <path d="M94 127 Q107 134 121 126" fill="none" stroke={palette.ink} strokeWidth="2.8" />
    <circle cx="105" cy="80" r="3.1" fill={palette.coral} stroke="none" />
    <path d="M70 102 Q65 104 68 113 M145 101 Q150 103 146 112" fill="none" stroke={palette.skin} strokeWidth="5" />
    <circle cx="67" cy="115" r="3" fill={palette.mustard} strokeWidth="1.5" />
    <circle cx="147" cy="114" r="3" fill={palette.mustard} strokeWidth="1.5" />
    {action === 'ledger' && <g transform="rotate(-8 50 230)"><path d="M49 211 L102 207 L110 267 L56 271 Z" fill={palette.paper} /><path d="M58 220 L95 217 M59 230 L97 227 M60 240 L99 237 M61 250 L90 248" fill="none" stroke={palette.blue} strokeWidth="2" /><path d="M104 215 l13 -15" fill="none" stroke={palette.coral} strokeWidth="4" /></g>}
    {action === 'count' && <g><path d="M45 223 L104 218 L109 269 L51 273 Z" fill={palette.paper} /><circle cx="59" cy="238" r="7" fill={palette.mustard} /><circle cx="78" cy="249" r="7" fill={palette.mustard} /><circle cx="96" cy="237" r="7" fill={palette.coralLight} /></g>}
    {facing === 'side' && <path d="M132 104 Q127 108 120 107" fill="none" />}
  </g>
}

function Shelf({ x, y, width = 250, rows = 2 }) {
  const items = Array.from({ length: 5 }, (_, i) => i)
  return <g transform={`translate(${x} ${y})`} stroke={palette.ink} strokeWidth="3" strokeLinejoin="round">
    <rect width={width} height={rows * 74 + 14} rx="3" fill={palette.paperDark} />
    {Array.from({ length: rows }, (_, row) => <g key={row} transform={`translate(0 ${row * 74})`}>
      <path d={`M0 68 H${width}`} stroke={palette.wood} strokeWidth="8" />
      {items.map((item) => {
        const itemWidth = 29 + (item % 3) * 7
        const ix = 12 + item * 45
        const colors = [palette.coralLight, palette.mustard, palette.greenLight, palette.blueLight, '#f0c97f']
        return <g key={item} transform={`translate(${ix} ${9 + (item % 2) * 4})`}>
          <rect x="0" y="13" width={itemWidth} height="44" rx="3" fill={colors[(item + row) % colors.length]} />
          <path d={`M4 25 H${itemWidth - 4} M4 31 H${itemWidth - 7}`} stroke="#fff8e8" strokeWidth="2" />
          <path d={`M${itemWidth / 2} 8 l5 5 h-10 z`} fill={palette.coral} />
        </g>
      })}
    </g>)}
  </g>
}

function Book({ x, y, scale = 1, open = true }) {
  return <g transform={`translate(${x} ${y}) scale(${scale})`} stroke={palette.ink} strokeWidth="3" strokeLinejoin="round">
    <path d="M0 14 Q35 0 67 14 V94 Q35 80 0 94 Z" fill={palette.paper} />
    {open && <path d="M67 14 Q100 0 134 14 V94 Q100 80 67 94 Z" fill="#fffaf0" />}
    <path d="M10 31 Q35 23 55 31 M10 43 Q34 35 55 43 M10 55 Q35 47 55 55 M78 31 Q101 23 123 31 M78 43 Q101 35 123 43 M78 55 Q101 47 123 55" fill="none" stroke={palette.blue} strokeWidth="2" />
    <path d="M11 72 H38 M79 72 H112" stroke={palette.coral} strokeWidth="3" />
    <path d="M67 14 V94" />
  </g>
}

function SceneBackground({ scene }) {
  const fills = { shop: '#e9d6bd', stock: '#e9ddc9', billing: '#efdfca', credit: '#e5d7c2', operations: '#e9ddc9', customer: '#eedfca', profit: '#dce6dc', guide: '#ede1cd', auth: '#f0e5d2', portrait: '#ead9c3' }
  return <>
    <rect width="1200" height="680" fill={fills[scene] || fills.shop} />
    <path d="M0 492 Q250 463 460 488 T900 478 T1200 486 V680 H0Z" fill="#d3b896" opacity=".55" />
    <path d="M0 523 H1200" stroke="#a98162" strokeWidth="3" opacity=".35" />
    <circle cx="100" cy="85" r="48" fill="#fff8e8" opacity=".42" />
    <path d="M45 155 q22 -25 44 0 M1080 122 q20 -23 40 0" fill="none" stroke="#fff8e8" strokeWidth="6" opacity=".5" />
  </>
}

function ShopInterior() {
  return <g>
    <path d="M42 115 H1158 V478 H42Z" fill="#f3e7d4" stroke={palette.ink} strokeWidth="4" />
    <path d="M42 115 L600 26 L1158 115" fill="#d7b697" stroke={palette.ink} strokeWidth="4" />
    <path d="M56 125 H1144" stroke="#fff8e8" strokeWidth="9" />
    <Shelf x={89} y={173} width={264} rows={3} />
    <Shelf x={846} y={162} width={267} rows={3} />
    <path d="M398 151 H797 V328 H398Z" fill="#c4d7d5" stroke={palette.ink} strokeWidth="4" />
    <path d="M597 151 V328 M398 244 H797" stroke="#fff8e8" strokeWidth="9" />
    <path d="M427 171 q64 -49 124 0 M638 171 q61 -49 123 0" fill="none" stroke="#7798a2" strokeWidth="5" />
    <rect x="505" y="66" width="191" height="63" rx="3" fill={palette.green} stroke={palette.ink} strokeWidth="3" />
    <text x="600" y="105" textAnchor="middle" fill="#fff8e8" fontSize="24" fontFamily="Georgia, serif" letterSpacing="2">APNI DUKAAN</text>
    <path d="M0 477 H1200 V680 H0Z" fill={palette.wood} stroke={palette.ink} strokeWidth="4" />
    <path d="M0 493 Q250 477 480 493 T930 490 T1200 496" fill="none" stroke="#d69a67" strokeWidth="7" />
    <path d="M31 514 H1168" stroke="#694b3c" strokeWidth="2" opacity=".5" />
  </g>
}

function Props({ scene }) {
  if (scene === 'stock') return <g>
    <Shelf x={56} y={82} width={490} rows={4} />
    <rect x="712" y="344" width="345" height="129" rx="3" fill="#d5aa7f" stroke={palette.ink} strokeWidth="4" />
    <rect x="755" y="303" width="105" height="170" rx="3" fill={palette.mustard} stroke={palette.ink} strokeWidth="4" />
    <rect x="874" y="324" width="147" height="149" rx="3" fill={palette.coralLight} stroke={palette.ink} strokeWidth="4" />
    <path d="M750 398 H1022 M758 426 H1009" stroke="#fff8e8" strokeWidth="6" opacity=".8" />
    <rect x="597" y="99" width="98" height="92" rx="6" fill="#fff8e8" stroke={palette.coral} strokeWidth="4" />
    <path d="M621 140 l15 16 34 -42" fill="none" stroke={palette.green} strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M584 215 q48 -23 98 0" fill="none" stroke={palette.coral} strokeWidth="4" strokeDasharray="7 10" />
  </g>
  if (scene === 'billing') return <g>
    <path d="M72 454 H1135" stroke={palette.wood} strokeWidth="28" strokeLinecap="round" />
    <Book x={552} y={348} scale={1.15} />
    <path d="M893 378 L1016 367 L1027 468 L904 478 Z" fill="#fffaf0" stroke={palette.ink} strokeWidth="4" />
    <path d="M911 402 H999 M913 424 H1001 M916 445 H979" stroke={palette.blue} strokeWidth="4" />
    <circle cx="500" cy="427" r="21" fill={palette.mustard} stroke={palette.ink} strokeWidth="4" />
    <text x="500" y="435" textAnchor="middle" fill={palette.ink} fontSize="24" fontWeight="700">₹</text>
    <path d="M1028 376 l63 -34" stroke={palette.coral} strokeWidth="8" strokeLinecap="round" />
  </g>
  if (scene === 'credit') return <g>
    <path d="M95 470 H1105" stroke={palette.wood} strokeWidth="28" strokeLinecap="round" />
    <Book x={491} y={338} scale={1.08} />
    <path d="M155 383 Q178 319 227 325 Q275 330 287 399 L287 471 H151Z" fill={palette.blue} stroke={palette.ink} strokeWidth="4" />
    <circle cx="222" cy="296" r="42" fill="#96644f" stroke={palette.ink} strokeWidth="4" />
    <path d="M183 293 q39 -54 78 -7 M202 299 h2 M238 299 h2 M211 316 q12 8 24 -1" fill="none" stroke={palette.ink} strokeWidth="4" />
    <path d="M282 395 Q340 399 391 376" fill="none" stroke="#96644f" strokeWidth="14" strokeLinecap="round" />
    <path d="M1017 360 Q1045 350 1080 359 V443 Q1049 431 1017 443Z" fill="#fffaf0" stroke={palette.ink} strokeWidth="4" />
    <path d="M1030 382 H1067 M1030 399 H1067 M1030 416 H1058" stroke={palette.coral} strokeWidth="3" />
  </g>
  if (scene === 'customer') return <g>
    <path d="M83 470 H1120" stroke={palette.wood} strokeWidth="27" strokeLinecap="round" />
    <path d="M106 228 Q132 178 177 184 Q223 192 229 251 L225 470 H102Z" fill={palette.coralLight} stroke={palette.ink} strokeWidth="4" />
    <circle cx="166" cy="157" r="39" fill="#98634e" stroke={palette.ink} strokeWidth="4" />
    <path d="M130 156 q32 -56 72 -13 M149 160 h2 M180 160 h2 M156 175 q12 7 22 -1" fill="none" stroke={palette.ink} strokeWidth="4" />
    <path d="M219 337 q52 50 111 26" fill="none" stroke="#98634e" strokeWidth="13" strokeLinecap="round" />
    <path d="M237 335 q43 -7 61 20" fill="none" stroke="#e6c499" strokeWidth="10" strokeLinecap="round" />
    <path d="M341 351 q34 -47 74 0" fill="none" stroke={palette.coral} strokeWidth="4" strokeDasharray="5 10" />
    <path d="M929 366 H1063 V449 H929Z" fill={palette.paper} stroke={palette.ink} strokeWidth="4" />
    <path d="M953 390 H1038 M953 409 H1038 M953 428 H1023" stroke={palette.blue} strokeWidth="3" />
  </g>
  if (scene === 'profit') return <g>
    <path d="M68 469 H1127" stroke={palette.wood} strokeWidth="26" strokeLinecap="round" />
    <Book x={518} y={350} scale={1.1} />
    <rect x="193" y="316" width="168" height="134" rx="8" fill="#d7ded1" stroke={palette.ink} strokeWidth="4" />
    <rect x="209" y="330" width="136" height="49" rx="3" fill="#e9f0e4" stroke={palette.ink} strokeWidth="3" />
    <text x="277" y="363" textAnchor="middle" fill={palette.green} fontSize="27" fontFamily="monospace">₹ +</text>
    <g fill={palette.mustard} stroke={palette.ink} strokeWidth="3"><circle cx="225" cy="407" r="12"/><circle cx="261" cy="407" r="12"/><circle cx="297" cy="407" r="12"/><circle cx="333" cy="407" r="12"/></g>
    <path d="M857 441 L885 409 L912 422 L949 371" fill="none" stroke={palette.coral} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M944 372 l14 -4 -3 15" fill="none" stroke={palette.coral} strokeWidth="6" />
  </g>
  if (scene === 'operations') return <g>
    <Shelf x={57} y={112} width={325} rows={3} />
    <path d="M82 473 H1118" stroke={palette.wood} strokeWidth="26" strokeLinecap="round" />
    <rect x="791" y="333" width="231" height="127" fill={palette.paper} stroke={palette.ink} strokeWidth="4" />
    <path d="M819 362 H997 M819 389 H997 M819 416 H965" stroke={palette.blue} strokeWidth="4" />
    <circle cx="722" cy="377" r="25" fill={palette.mustard} stroke={palette.ink} strokeWidth="4" />
    <path d="M722 362 V378 L735 387" fill="none" stroke={palette.ink} strokeWidth="4" strokeLinecap="round" />
    <path d="M1050 364 l18 18 32 -37" fill="none" stroke={palette.green} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
  </g>
  return null
}

const sceneLabels = {
  shop: 'A kirana shopkeeper reviewing the day’s shop ledger',
  stock: 'A shopkeeper checks stock beside neatly arranged shop shelves',
  billing: 'A shopkeeper records a sale in a paper ledger',
  credit: 'A shopkeeper records a customer’s credit in a ledger',
  operations: 'A shopkeeper organizes daily shop records',
  customer: 'A shopkeeper helps a customer at the counter',
  profit: 'A shopkeeper reviews expenses and daily earnings',
  guide: 'A shopkeeper keeps track of stock and customer payments',
  portrait: 'Portrait illustration of the ArthSaathi shopkeeper mascot',
  auth: 'The ArthSaathi shopkeeper mascot',
}

export function ArthSaathiMark({ className = '', title = 'ArthSaathi', decorative = false }) {
  return <svg className={className} width="20" height="20" viewBox="0 0 40 40" role={decorative ? undefined : 'img'} aria-label={decorative ? undefined : title} aria-hidden={decorative || undefined}>
    <circle cx="20" cy="20" r="19" fill={palette.paper} />
    <path d="M9 18 Q9 5 20 5 Q31 5 31 18 V23 H9Z" fill={palette.hair} />
    <path d="M11 17 Q12 9 20 9 Q28 9 29 17 V27 Q28 33 20 33 Q12 33 11 27Z" fill={palette.skinLight} />
    <path d="M15 20 h1 M24 20 h1 M17 27 q3 2 6 0" stroke={palette.ink} strokeWidth="1.8" strokeLinecap="round" />
    <path d="M14 29 Q20 34 26 29 L29 38 H11Z" fill={palette.apron} />
    <circle cx="20" cy="15" r="1.5" fill={palette.coral} />
  </svg>
}

export function ArthSaathiIllustration({ scene = 'shop', className = '', title }) {
  const label = title || sceneLabels[scene] || sceneLabels.shop
  return <svg className={className} viewBox="0 0 1200 680" preserveAspectRatio="xMidYMid slice" role="img" aria-label={label}>
    <SceneBackground scene={scene} />
    {scene === 'shop' ? <ShopInterior /> : <Props scene={scene} />}
    {scene === 'portrait' || scene === 'auth' ? <g>
      <circle cx="600" cy="330" r="225" fill="#fff7e9" opacity=".65" />
      <Shopkeeper x={455} y={220} scale={1.45} action="greet" />
      <path d="M483 550 q117 -32 234 0" fill="none" stroke={palette.wood} strokeWidth="7" opacity=".4" />
      <circle cx="405" cy="325" r="28" fill={palette.mustard} opacity=".75" />
      <path d="M795 300 l20 18 -20 18 -20 -18Z" fill={palette.coral} opacity=".8" />
    </g> : <Shopkeeper x={scene === 'shop' ? 486 : 435} y={scene === 'shop' ? 255 : 185} scale={scene === 'shop' ? 1.55 : 1.25} action={['stock', 'customer'].includes(scene) ? 'greet' : scene === 'profit' ? 'count' : 'ledger'} />}
    {scene === 'shop' && <g>
      <rect x="241" y="420" width="158" height="93" rx="3" fill={palette.blueLight} stroke={palette.ink} strokeWidth="4" />
      <path d="M258 442 H378 M258 462 H362 M258 482 H341" stroke="#fff8e8" strokeWidth="7" />
      <path d="M857 430 l70 -15 16 81 -71 12Z" fill={palette.paper} stroke={palette.ink} strokeWidth="4" />
      <path d="M874 448 L924 438 M878 463 L927 454 M882 478 L929 469" stroke={palette.coral} strokeWidth="3" />
      <path d="M460 432 q14 -29 29 0 M460 433 v34 M489 433 v34" fill="none" stroke={palette.green} strokeWidth="5" />
      <circle cx="1010" cy="474" r="20" fill={palette.mustard} stroke={palette.ink} strokeWidth="3" />
      <text x="1010" y="481" textAnchor="middle" fill={palette.ink} fontSize="20" fontWeight="700">₹</text>
    </g>}
  </svg>
}
