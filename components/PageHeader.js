"use client";

export default function PageHeader({ title, subtitle }) {
  return (
    <section className="ca-panel">
      <h1 className="ca-title">{title}</h1>
      {subtitle ? <p className="ca-muted mt-1">{subtitle}</p> : null}
    </section>
  );
}
