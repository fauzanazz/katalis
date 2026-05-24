import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { DATA_RETENTION_POLICY } from "@/lib/parent/data-retention";

export const metadata: Metadata = {
  title: "Privacy Policy — Katalis",
  description:
    "How Katalis collects, uses, and protects your child's data in compliance with COPPA.",
};

const CONTACT_EMAIL = "privacy@katalis.app";

export default async function PrivacyPage() {
  const t = await getTranslations("privacy");

  const retentionRows: { label: string; days: number; key: string }[] = [
    {
      label: t("dataRetention.mentorChat"),
      days: DATA_RETENTION_POLICY.mentorMessageDays,
      key: "mentorChat",
    },
    {
      label: t("dataRetention.reflections"),
      days: DATA_RETENTION_POLICY.reflectionDays,
      key: "reflections",
    },
    {
      label: t("dataRetention.discoveryArtifacts"),
      days: DATA_RETENTION_POLICY.discoveryArtifactDays,
      key: "discoveryArtifacts",
    },
    {
      label: t("dataRetention.interestSignals"),
      days: DATA_RETENTION_POLICY.interestSignalDays,
      key: "interestSignals",
    },
    {
      label: t("dataRetention.auditLogs"),
      days: DATA_RETENTION_POLICY.auditMinimumDays,
      key: "auditLogs",
    },
  ];

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <header className="mb-10">
        <p className="text-sm font-semibold uppercase tracking-widest text-black/50">
          {t("lastUpdated")}
        </p>
        <h1 className="mt-2 text-4xl font-black tracking-tight text-black">
          {t("title")}
        </h1>
        <p className="mt-1 text-lg font-semibold text-black/60">
          {t("subtitle")}
        </p>
      </header>

      <section className="mb-8">
        <p className="text-base leading-relaxed text-black/80">{t("intro")}</p>
        <p className="mt-4 text-base leading-relaxed text-black/80">
          {t("coppa")}
        </p>
        <p className="mt-4 text-base font-semibold text-black/80">
          {t("noTracking")}
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-4 text-2xl font-black text-black">
          {t("dataRetention.title")}
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
          {t("yourRights.title")}
        </h2>
        <ul className="space-y-3 text-base leading-relaxed text-black/80">
          <li>{t("yourRights.access")}</li>
          <li>{t("yourRights.deletion")}</li>
          <li>{t("yourRights.sla")}</li>
        </ul>
      </section>

      <section>
        <h2 className="mb-3 text-2xl font-black text-black">
          {t("contact.title")}
        </h2>
        <p className="text-base leading-relaxed text-black/80">
          {t("contact.text")}
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
