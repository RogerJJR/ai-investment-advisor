// Reusable small components: Sparkline, Donut, StackedBar, ConfidenceMeter, etc.

function Sparkline({ values, color = 'var(--accent)', height = 40, width = 160, fill = true }) {
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const step = width / (values.length - 1);
  const pts = values.map((v, i) => `${i*step},${height - ((v-min)/range)*(height-4) - 2}`).join(' ');
  const area = `0,${height} ${pts} ${width},${height}`;
  return (
    <svg width={width} height={height} style={{display:'block'}}>
      {fill && <polygon points={area} fill={color} opacity="0.1"/>}
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

function AreaChart({ series, width = 640, height = 220, labels = [] }) {
  // series: [{label, color, values:[]}]
  const all = series.flatMap(s => s.values);
  const max = Math.max(...all);
  const min = Math.min(...all, 0);
  const range = max - min || 1;
  const pad = { t: 10, r: 10, b: 26, l: 40 };
  const W = width - pad.l - pad.r;
  const H = height - pad.t - pad.b;
  const nX = series[0].values.length - 1;
  const x = i => pad.l + (i / nX) * W;
  const y = v => pad.t + H - ((v - min) / range) * H;

  // grid ticks
  const ticks = 4;
  const yTicks = Array.from({length: ticks+1}, (_,i) => min + (range*i/ticks));

  return (
    <svg width={width} height={height} style={{display:'block', overflow:'visible'}}>
      {yTicks.map((t, i) => (
        <g key={i}>
          <line x1={pad.l} x2={width-pad.r} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth="1"/>
          <text x={pad.l - 8} y={y(t)+3} fontSize="10" fill="var(--text-3)" textAnchor="end" fontFamily="var(--font-mono)">{t.toFixed(0)}</text>
        </g>
      ))}
      {labels.map((lb, i) => (
        <text key={i} x={x(i)} y={height-8} fontSize="10" fill="var(--text-3)" textAnchor="middle" fontFamily="var(--font-mono)">{lb}</text>
      ))}
      {series.map((s, si) => {
        const pts = s.values.map((v,i) => `${x(i)},${y(v)}`).join(' ');
        const area = `${x(0)},${y(min)} ${pts} ${x(nX)},${y(min)}`;
        return (
          <g key={si}>
            {si === 0 && <polygon points={area} fill={s.color} opacity="0.12"/>}
            <polyline points={pts} fill="none" stroke={s.color} strokeWidth="1.75" strokeLinecap="round"/>
            {s.values.map((v,i) => (
              <circle key={i} cx={x(i)} cy={y(v)} r="2.5" fill={s.color}/>
            ))}
          </g>
        );
      })}
    </svg>
  );
}

function BarChart({ items, width = 640, height = 200 }) {
  // items: [{label, current, target, color}]
  const max = Math.max(...items.flatMap(i => [i.current, i.target])) * 1.1;
  const pad = { t: 20, r: 10, b: 30, l: 40 };
  const W = width - pad.l - pad.r;
  const H = height - pad.t - pad.b;
  const groupW = W / items.length;
  const barW = groupW * 0.3;
  return (
    <svg width={width} height={height} style={{display:'block'}}>
      {[0, max*0.25, max*0.5, max*0.75, max].map((t,i) => (
        <g key={i}>
          <line x1={pad.l} x2={width-pad.r} y1={pad.t + H - (t/max)*H} y2={pad.t + H - (t/max)*H} stroke="var(--line)"/>
          <text x={pad.l-8} y={pad.t + H - (t/max)*H + 3} fontSize="10" fill="var(--text-3)" textAnchor="end" fontFamily="var(--font-mono)">{t.toFixed(0)}%</text>
        </g>
      ))}
      {items.map((it, i) => {
        const gx = pad.l + i*groupW + groupW/2;
        const curH = (it.current/max)*H;
        const tgtH = (it.target/max)*H;
        return (
          <g key={it.name}>
            <rect x={gx - barW - 2} y={pad.t + H - curH} width={barW} height={curH} fill={it.color} opacity="0.9" rx="2"/>
            <rect x={gx + 2} y={pad.t + H - tgtH} width={barW} height={tgtH} fill={it.color} opacity="0.35" rx="2" stroke={it.color} strokeWidth="1" strokeDasharray="2 2"/>
            <text x={gx} y={height-10} fontSize="11" fill="var(--text-2)" textAnchor="middle">{it.name}</text>
          </g>
        );
      })}
    </svg>
  );
}

function Donut({ slices, size = 140, thick = 18 }) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  const r = size/2 - thick/2;
  const C = 2 * Math.PI * r;
  let offset = 0;
  return (
    <svg width={size} height={size} style={{transform:'rotate(-90deg)'}}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--bg-3)" strokeWidth={thick}/>
      {slices.map((s, i) => {
        const pct = s.value/total;
        const dash = pct * C;
        const el = (
          <circle key={i} cx={size/2} cy={size/2} r={r} fill="none"
            stroke={s.color} strokeWidth={thick}
            strokeDasharray={`${dash} ${C-dash}`}
            strokeDashoffset={-offset}
          />
        );
        offset += dash;
        return el;
      })}
    </svg>
  );
}

function StackedBar({ items, showLabels = true }) {
  const total = items.reduce((s,x)=>s+x.value,0);
  return (
    <div className="stack-bar">
      {items.map((it,i)=>{
        const w = (it.value/total)*100;
        return (
          <div key={i} style={{width: w+'%', background: it.color}} title={`${it.name}: ${it.value}%`}>
            {showLabels && w > 8 && `${it.value.toFixed(0)}%`}
          </div>
        );
      })}
    </div>
  );
}

function ConfidenceMeter({ value }) {
  const level = value >= 75 ? 'high' : value >= 50 ? '' : 'low';
  const filled = Math.round(value/10);
  return (
    <div className={'conf-meter ' + level}>
      {Array.from({length:10}).map((_,i) => (
        <i key={i} className={i<filled?'on':''}/>
      ))}
    </div>
  );
}

function ImpactPill({ level }) {
  const map = { high: { cls: 'neg', label: '高' }, medium: { cls: 'warn', label: '中' }, low: { cls: 'accent', label: '低' }, info: { cls: 'accent', label: '訊息' } };
  const m = map[level] || { cls: '', label: level };
  return <span className={'chip ' + m.cls}><span className="dot"/>{m.label}</span>;
}

Object.assign(window, { Sparkline, AreaChart, BarChart, Donut, StackedBar, ConfidenceMeter, ImpactPill });
