import { createFileRoute } from "@tanstack/react-router";
import { m } from "@/paraglide/messages";
import { DATA_RETENTION_POLICY } from "@/lib/parent/data-retention";

export const Route = createFileRoute("/$locale/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Katalis" },
      {
        name: "description",
        content:
          "How Katalis collects, uses, and protects your child's data in compliance with COPPA.",
      },
    ],
  }),
  component: PrivacyPage,
});

const CONTACT_EMAIL = "privacy@katalis.app";

const cookieRows = [
  {
    name: m.privacy_cookies_rows_0_name(),
    purpose: m.privacy_cookies_rows_0_purpose(),
    duration: m.privacy_cookies_rows_0_duration(),
  },
  {
    name: m.privacy_cookies_rows_1_name(),
    purpose: m.privacy_cookies_rows_1_purpose(),
    duration: m.privacy_cookies_rows_1_duration(),
  },
  {
    name: m.privacy_cookies_rows_2_name(),
    purpose: m.privacy_cookies_rows_2_purpose(),
    duration: m.privacy_cookies_rows_2_duration(),
  },
];

function PrivacyPage() {
  const retentionRows: { label: string; days: number; key: string }[] = [
    {
      label: m.privacy_dataRetention_mentorChat(),
      days: DATA_RETENTION_POLICY.mentorMessageDays,
      key: "mentorChat",
    },
    {
      label: m.privacy_dataRetention_reflections(),
      days: DATA_RETENTION_POLICY.reflectionDays,
      key: "reflections",
    },
    {
      label: m.privacy_dataRetention_discoveryArtifacts(),
      days: DATA_RETENTION_POLICY.discoveryArtifactDays,
      key: "discoveryArtifacts",
    },
    {
      label: m.privacy_dataRetention_interestSignals(),
      days: DATA_RETENTION_POLICY.interestSignalDays,
      key: "interestSignals",
    },
    {
      label: m.privacy_dataRetention_auditLogs(),
      days: DATA_RETENTION_POLICY.auditMinimumDays,
      key: "auditLogs",
    },
  ];

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <header className="mb-10">
        <p className="text-sm font-semibold uppercase tracking-widest text-black/50">
          {m.privacy_lastUpdated()}
        </p>
        <h1 className="mt-2 text-4xl font-black tracking-tight text-black">
          {m.privacy_title()}
        </h1>
        <p className="mt-1 text-lg font-semibold text-black/60">
          {m.privacy_subtitle()}
        </p>
      </header>

      <section className="mb-8">
        <p className="text-base leading-relaxed text-black/80">{m.privacy_intro()}</p>
        <p className="mt-4 text-base leading-relaxed text-black/80">
          {m.privacy_coppa()}
        </p>
        <p className="mt-4 text-base font-semibold text-black/80">
          {m.privacy_noTracking()}
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-4 text-2xl font-black text-black">
          {m.privacy_dataRetention_title()}
        </h2>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b-2 border-black text-left">
              <th className="pb-2 pr-4 font-bold text-black">Data type</th>
              <th className="pb-2 font-bold text-black">Kept for</th>
            </tr>
          </thead>
          <tbody>
            {retentionRows.map(({ key, label, days }) => (
              <tr key={key} className="border-b border-black/10">
                <td className="py-3 pr-4 leading-snug text-black/75">{label}</td>
                <td className="py-3 font-semibold text-black">
                  {days >= 365
                    ? `${days / 365} year${days / 365 > 1 ? "s" : ""}`
                    : `${Math.round(days / 30)} months`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-2xl font-black text-black">
          {m.privacy_yourRights_title()}
        </h2>
        <ul className="space-y-3 text-base leading-relaxed text-black/80">
          <li>{m.privacy_yourRights_access()}</li>
          <li>{m.privacy_yourRights_deletion()}</li>
          <li>{m.privacy_yourRights_sla()}</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-2xl font-black text-black">
          {m.privacy_cookies_title()}
        </h2>
        <p className="mb-4 text-base leading-relaxed text-black/80">
          {m.privacy_cookies_intro()}
        </p>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b-2 border-black text-left">
              <th className="pb-2 pr-4 font-bold text-black">{m.privacy_cookies_tableHeaderName()}</th>
              <th className="pb-2 pr-4 font-bold text-black">{m.privacy_cookies_tableHeaderPurpose()}</th>
              <th className="pb-2 font-bold text-black">{m.privacy_cookies_tableHeaderDuration()}</th>
            </tr>
          </thead>
          <tbody>
            {cookieRows.map((row) => (
              <tr key={row.name} className="border-b border-black/10">
                <td className="py-3 pr-4 font-mono text-xs font-semibold text-black">{row.name}</td>
                <td className="py-3 pr-4 leading-snug text-black/75">{row.purpose}</td>
                <td className="py-3 whitespace-nowrap text-black/75">{row.duration}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-4 text-sm leading-relaxed text-black/60">
          {m.privacy_cookies_localStorage()}
        </p>
      </section>

      <section>
        <h2 className="mb-3 text-2xl font-black text-black">
          {m.privacy_contact_title()}
        </h2>
        <p className="text-base leading-relaxed text-black/80">
          {m.privacy_contact_text()}
        </p>
        <a
          href={`mailto:${CONTACT_EMAIL}`}
          className="mt-2 inline-block font-bold text-black underline underline-offset-2 hover:opacity-70"
        >
          {CONTACT_EMAIL}
        </a>
      </section>
    </main>
  );
}
