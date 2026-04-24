/**
 * PDF template for parent reports using @react-pdf/renderer.
 * Renders strengths, growth areas, tips, and badges in a printable format.
 */

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: "Helvetica",
    fontSize: 11,
    color: "#1a1a1a",
  },
  header: {
    marginBottom: 24,
    borderBottomWidth: 2,
    borderBottomColor: "#f59e0b",
    paddingBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1a1a1a",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    color: "#6b7280",
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#f59e0b",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  summaryCard: {
    backgroundColor: "#fefce8",
    padding: 12,
    borderRadius: 6,
    marginBottom: 8,
  },
  cardText: {
    fontSize: 10,
    color: "#4b5563",
    lineHeight: 1.5,
  },
  strengthCard: {
    backgroundColor: "#f0fdf4",
    padding: 10,
    borderRadius: 6,
    marginBottom: 6,
    borderLeftWidth: 3,
    borderLeftColor: "#22c55e",
  },
  growthCard: {
    backgroundColor: "#fffbeb",
    padding: 10,
    borderRadius: 6,
    marginBottom: 6,
    borderLeftWidth: 3,
    borderLeftColor: "#f59e0b",
  },
  tipCard: {
    backgroundColor: "#eff6ff",
    padding: 10,
    borderRadius: 6,
    marginBottom: 6,
    borderLeftWidth: 3,
    borderLeftColor: "#3b82f6",
  },
  tipTitle: {
    fontSize: 11,
    fontWeight: "bold",
    marginBottom: 4,
    color: "#1e40af",
  },
  tipDescription: {
    fontSize: 9,
    color: "#1e3a8a",
    marginBottom: 4,
  },
  materialsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginTop: 4,
  },
  materialBadge: {
    backgroundColor: "#dbeafe",
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 8,
    fontSize: 8,
    color: "#1d4ed8",
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  badge: {
    backgroundColor: "#f3e8ff",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    fontSize: 10,
    color: "#7c3aed",
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    fontSize: 9,
    color: "#9ca3af",
    textAlign: "center",
  },
});

interface Tip {
  title: string;
  description: string;
  materials?: string[];
}

interface ReportData {
  childName: string;
  period: string;
  type: string;
  generatedAt: string;
  summary: string;
  strengths: string[];
  growthAreas: string[];
  tips: Tip[];
  badgeHighlights: string[];
}

export function ParentReportPDF({ data }: { data: ReportData }) {
  const reportTitle = data.type === "weekly" ? "Weekly Progress Report" : "Bi-Weekly Progress Report";

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Katalis {reportTitle}</Text>
          <Text style={styles.subtitle}>
            {data.childName} • {data.period}
          </Text>
        </View>

        {/* Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Summary</Text>
          <View style={styles.summaryCard}>
            <Text style={styles.cardText}>{data.summary}</Text>
          </View>
        </View>

        {/* Strengths */}
        {data.strengths.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Strengths Discovered</Text>
            {data.strengths.map((strength, i) => (
              <View key={i} style={styles.strengthCard}>
                <Text style={styles.cardText}>✓ {strength}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Growth Areas */}
        {data.growthAreas.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Growth Opportunities</Text>
            {data.growthAreas.map((area, i) => (
              <View key={i} style={styles.growthCard}>
                <Text style={styles.cardText}>→ {area}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Badges */}
        {data.badgeHighlights.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Badges Earned</Text>
            <View style={styles.badgeRow}>
              {data.badgeHighlights.map((badge, i) => (
                <Text key={i} style={styles.badge}>
                  {badge.replace(/_/g, " ")}
                </Text>
              ))}
            </View>
          </View>
        )}

        {/* Tips */}
        {data.tips.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Tips for Parents</Text>
            {data.tips.slice(0, 4).map((tip, i) => (
              <View key={i} style={styles.tipCard}>
                <Text style={styles.tipTitle}>{tip.title}</Text>
                <Text style={styles.tipDescription}>{tip.description}</Text>
                {tip.materials && tip.materials.length > 0 && (
                  <View style={styles.materialsRow}>
                    {tip.materials.map((mat, j) => (
                      <Text key={j} style={styles.materialBadge}>
                        {mat}
                      </Text>
                    ))}
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Footer */}
        <Text style={styles.footer}>
          Generated on {data.generatedAt} • Katalis AI • katalis.app
        </Text>
      </Page>
    </Document>
  );
}
