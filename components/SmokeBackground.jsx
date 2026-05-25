export default function SmokeBackground() {
  return (
    <div className="fixed inset-0 -z-10" style={{ background: '#f8f8f6' }}>
      <svg width="100%" height="100%" viewBox="0 0 800 600" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" className="absolute inset-0 w-full h-full">
        <ellipse cx="200" cy="350" rx="320" ry="180" fill="#efefec" opacity="0.6"/>
        <ellipse cx="600" cy="200" rx="280" ry="160" fill="#e8e8e4" opacity="0.5"/>
        <ellipse cx="400" cy="450" rx="350" ry="140" fill="#f0f0ec" opacity="0.7"/>
        <ellipse cx="100" cy="150" rx="200" ry="120" fill="#eaeae6" opacity="0.4"/>
        <ellipse cx="700" cy="500" rx="250" ry="130" fill="#ececea" opacity="0.5"/>
        <ellipse cx="350" cy="280" rx="400" ry="200" fill="#f2f2ee" opacity="0.5"/>
        <ellipse cx="500" cy="100" rx="300" ry="100" fill="#edede9" opacity="0.3"/>
        <path d="M50 400 Q200 350 350 380 Q500 410 650 360 Q750 330 800 350" fill="none" stroke="#000000" strokeWidth="1.5" opacity="0.15"/>
        <path d="M0 420 Q150 380 300 400 Q450 420 600 390 Q700 370 800 380" fill="none" stroke="#000000" strokeWidth="2.5" opacity="0.08"/>
        <path d="M100 300 Q250 270 400 290 Q550 310 700 280" fill="none" stroke="#000000" strokeWidth="1" opacity="0.12"/>
        <ellipse cx="350" cy="380" rx="120" ry="60" fill="#000000" opacity="0.04"/>
        <ellipse cx="550" cy="300" rx="80" ry="50" fill="#000000" opacity="0.05"/>
        <ellipse cx="200" cy="250" rx="100" ry="40" fill="#000000" opacity="0.03"/>
        <line x1="0" y1="320" x2="800" y2="290" stroke="#000000" strokeWidth="0.5" opacity="0.2"/>
        <line x1="0" y1="380" x2="800" y2="360" stroke="#000000" strokeWidth="0.3" opacity="0.12"/>
        <circle cx="150" cy="200" r="1.5" fill="#d0d0cc" opacity="0.6"/>
        <circle cx="380" cy="150" r="1" fill="#000000" opacity="0.3"/>
        <circle cx="520" cy="250" r="1.5" fill="#d5d5d0" opacity="0.5"/>
        <circle cx="650" cy="180" r="1" fill="#000000" opacity="0.25"/>
        <circle cx="280" cy="420" r="1.5" fill="#d0d0cc" opacity="0.5"/>
        <circle cx="450" cy="350" r="1" fill="#000000" opacity="0.2"/>
        <circle cx="120" cy="480" r="1" fill="#dcdcd8" opacity="0.4"/>
        <circle cx="600" cy="450" r="1.5" fill="#000000" opacity="0.15"/>
        <circle cx="700" cy="120" r="1" fill="#d8d8d4" opacity="0.5"/>
        <circle cx="350" cy="500" r="1.5" fill="#000000" opacity="0.2"/>
        <defs>
          <linearGradient id="topFade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f8f8f6" stopOpacity="0.9"/>
            <stop offset="100%" stopColor="#f8f8f6" stopOpacity="0"/>
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="800" height="120" fill="url(#topFade)"/>
      </svg>
    </div>
  );
}
