/*
 * lib/smart-apply/buildDesignedCvPdf.tsx
 *
 * The HUMAN-FACING resume: a designed, two column PDF for networking, LinkedIn,
 * and sending straight to a hiring manager. This is the deliberate counterpart to
 * the single column "ATS Classic" PDF (workzoCvPdf.ts) and the ATS DOCX
 * (buildCvDocx.ts), which stay plain so applicant tracking systems parse them
 * cleanly. This file is the one you tell users to share with people, never the
 * one you tell them to paste into an ATS.
 *
 * WHY react-pdf
 *
 * A two column layout with a colored sidebar, custom fonts, and real typography
 * is miserable to hand assemble in raw DOCX or PDF XML. react-pdf renders it from
 * a component tree on the Node serverless runtime with no headless browser, so
 * there is no Puppeteer cold start and no Chromium binary to ship on Vercel.
 *
 * FIDELITY
 *
 * Like the other two builders, this COPIES the tailored profile faithfully. It
 * never summarizes, reorders, or invents. The profile has already passed the
 * evidence gate before it reaches here.
 *
 * FONTS
 *
 * For the sharpest look this uses Inter for body text and Merriweather for
 * headers. To keep the render deterministic and offline (no per request network
 * fetch), it loads the .ttf files from disk. Drop these six files into
 * assets/fonts at the repo root (or point WORKZO_CV_FONT_DIR at them):
 *
 *   Inter-Regular.ttf, Inter-Medium.ttf, Inter-SemiBold.ttf, Inter-Bold.ttf
 *   Merriweather-Regular.ttf, Merriweather-Bold.ttf
 *
 * If the files are not present yet, the template automatically falls back to the
 * built in Helvetica and Times-Roman, so it renders correctly the moment you wire
 * the route, and simply looks nicer once you vendor the fonts.
 *
 * INSTALL
 *
 *   npm i @react-pdf/renderer
 *
 * USAGE (in the export route, next to the docx branch)
 *
 *   import { buildDesignedCvPdfBytes } from "@/lib/smart-apply/buildDesignedCvPdf";
 *   const bytes = await buildDesignedCvPdfBytes(profile, targetRole);
 */

import fs from "node:fs";
import path from "node:path";
import React from "react";
import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
  Font,
  renderToBuffer,
} from "@react-pdf/renderer";
import type {
  ResumeProfile,
  ResumeExperience,
  ResumeEducation,
  ResumeProject,
} from "@/lib/workzoResumeParser";

export const DESIGNED_PDF_MIME = "application/pdf";

/* ── Theme: rebrand the whole document from one place ─────────────────────────
 * accent drives section titles and rules. sidebarBg is a subtle tint, not a loud
 * block, so it prints well and reads as professional restraint. Pass overrides
 * through the options arg to match a partner or a seasonal campaign.
 */
export type DesignedCvTheme = {
  accent: string;
  sidebarBg: string;
  sidebarInk: string;
  ink: string;
  muted: string;
  hairline: string;
};

const DEFAULT_THEME: DesignedCvTheme = {
  accent: "#2563EB",
  sidebarBg: "#F1F5F9",
  sidebarInk: "#0F172A",
  ink: "#0F172A",
  muted: "#475569",
  hairline: "#E2E8F0",
};

export type DesignedCvOptions = {
  targetRole?: string;
  pageSize?: "A4" | "LETTER";
  theme?: Partial<DesignedCvTheme>;
};

/* ── Font resolution: local files first, built in fallback second ──────────── */

const FONT_DIR =
  process.env.WORKZO_CV_FONT_DIR || path.join(process.cwd(), "assets", "fonts");

const RESOLVED = { sans: "Helvetica", serif: "Times-Roman" };
let FONTS_ATTEMPTED = false;

function registerIfPresent(
  family: string,
  files: Array<{ src: string; fontWeight: number }>,
): boolean {
  const present = files.filter((f) => {
    try {
      return fs.existsSync(f.src);
    } catch {
      return false;
    }
  });
  if (!present.length) return false;
  try {
    Font.register({ family, fonts: present });
    return true;
  } catch {
    return false;
  }
}

function ensureFonts() {
  if (FONTS_ATTEMPTED) return;
  FONTS_ATTEMPTED = true;

  // Resumes should never hyphenate words across lines.
  try {
    Font.registerHyphenationCallback((word) => [word]);
  } catch {
    /* non-fatal */
  }

  const sansOk = registerIfPresent("CvSans", [
    { src: path.join(FONT_DIR, "Inter-Regular.ttf"), fontWeight: 400 },
    { src: path.join(FONT_DIR, "Inter-Medium.ttf"), fontWeight: 500 },
    { src: path.join(FONT_DIR, "Inter-SemiBold.ttf"), fontWeight: 600 },
    { src: path.join(FONT_DIR, "Inter-Bold.ttf"), fontWeight: 700 },
  ]);
  const serifOk = registerIfPresent("CvSerif", [
    { src: path.join(FONT_DIR, "Merriweather-Regular.ttf"), fontWeight: 400 },
    { src: path.join(FONT_DIR, "Merriweather-Bold.ttf"), fontWeight: 700 },
  ]);

  RESOLVED.sans = sansOk ? "CvSans" : "Helvetica";
  RESOLVED.serif = serifOk ? "CvSerif" : "Times-Roman";
}

/* ── Small helpers ────────────────────────────────────────────────────────── */

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function nonEmpty(values: Array<string | undefined | null>): string[] {
  return values.map(clean).filter(Boolean);
}

const SIDEBAR_W = 188;

function makeStyles(theme: DesignedCvTheme) {
  const sans = RESOLVED.sans;
  const serif = RESOLVED.serif;

  return StyleSheet.create({
    page: {
      fontFamily: sans,
      fontSize: 9.5,
      color: theme.ink,
      lineHeight: 1.45,
      paddingTop: 0,
      paddingBottom: 0,
    },
    // Full height tinted band behind the left column. fixed repeats it on every
    // page, bottom:0 stretches it the full page height regardless of content.
    sidebarBand: {
      position: "absolute",
      top: 0,
      left: 0,
      bottom: 0,
      width: SIDEBAR_W,
      backgroundColor: theme.sidebarBg,
    },
    body: {
      flexDirection: "row",
    },
    sidebar: {
      width: SIDEBAR_W,
      paddingTop: 34,
      paddingBottom: 30,
      paddingHorizontal: 20,
      color: theme.sidebarInk,
    },
    main: {
      flex: 1,
      paddingTop: 34,
      paddingBottom: 30,
      paddingLeft: 26,
      paddingRight: 30,
    },

    name: {
      fontFamily: serif,
      fontWeight: 700,
      fontSize: 21,
      color: theme.ink,
      lineHeight: 1.15,
    },
    role: {
      fontSize: 10.5,
      color: theme.accent,
      fontWeight: 600,
      marginTop: 3,
    },
    headerRule: {
      marginTop: 12,
      marginBottom: 14,
      height: 2,
      width: 46,
      backgroundColor: theme.accent,
    },

    // Section title, used in both columns.
    sectionTitle: {
      fontFamily: serif,
      fontWeight: 700,
      fontSize: 10.5,
      color: theme.accent,
      textTransform: "uppercase",
      letterSpacing: 1.1,
      marginBottom: 6,
    },
    sidebarSection: { marginBottom: 16 },
    mainSection: { marginBottom: 15 },

    // Sidebar content.
    contactItem: { fontSize: 9, color: theme.sidebarInk, marginBottom: 3 },
    contactLabel: {
      fontSize: 7.5,
      color: theme.muted,
      textTransform: "uppercase",
      letterSpacing: 0.8,
      marginBottom: 1,
    },
    chip: {
      fontSize: 9,
      color: theme.sidebarInk,
      marginBottom: 3,
    },
    sidebarEduDegree: { fontSize: 9, fontWeight: 600, color: theme.sidebarInk },
    sidebarEduMeta: { fontSize: 8.5, color: theme.muted, marginBottom: 6 },

    // Main content.
    summary: { fontSize: 9.5, color: theme.ink },

    expItem: { marginBottom: 10 },
    expHeaderRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
    },
    expTitle: { fontSize: 10.5, fontWeight: 700, color: theme.ink },
    expDates: { fontSize: 8.5, color: theme.muted, marginLeft: 8 },
    expCompany: { fontSize: 9.5, color: theme.accent, fontWeight: 600, marginBottom: 3 },

    bulletRow: { flexDirection: "row", marginBottom: 2 },
    bulletDot: { width: 9, fontSize: 9.5, color: theme.accent },
    bulletText: { flex: 1, fontSize: 9.5, color: theme.ink },

    projName: { fontSize: 10, fontWeight: 700, color: theme.ink, marginBottom: 2 },
    projItem: { marginBottom: 8 },
  });
}

/* ── Presentational pieces ────────────────────────────────────────────────── */

type Styles = ReturnType<typeof makeStyles>;

function Bullet({ text, s }: { text: string; s: Styles }) {
  return (
    <View style={s.bulletRow}>
      <Text style={s.bulletDot}>{"\u2022"}</Text>
      <Text style={s.bulletText}>{text}</Text>
    </View>
  );
}

function ExperienceBlock({ items, s }: { items: ResumeExperience[]; s: Styles }) {
  const rows = items.filter((it) => clean(it.title) || clean(it.company));
  if (!rows.length) return null;
  return (
    <View style={s.mainSection}>
      <Text style={s.sectionTitle}>Experience</Text>
      {rows.map((it, i) => {
        const meta = nonEmpty([it.company, it.location]).join(", ");
        const bullets = (it.bullets || []).map(clean).filter(Boolean);
        return (
          <View key={i} style={s.expItem} wrap={false}>
            <View style={s.expHeaderRow}>
              <Text style={s.expTitle}>{clean(it.title) || meta}</Text>
              {clean(it.dates) ? <Text style={s.expDates}>{clean(it.dates)}</Text> : null}
            </View>
            {meta && clean(it.title) ? <Text style={s.expCompany}>{meta}</Text> : null}
            {bullets.map((b, bi) => (
              <Bullet key={bi} text={b} s={s} />
            ))}
          </View>
        );
      })}
    </View>
  );
}

function ProjectsBlock({ items, s }: { items: ResumeProject[]; s: Styles }) {
  const rows = items.filter((p) => clean(p.name) || (p.bullets || []).some(clean));
  if (!rows.length) return null;
  return (
    <View style={s.mainSection}>
      <Text style={s.sectionTitle}>Projects</Text>
      {rows.map((p, i) => {
        const bullets = (p.bullets || []).map(clean).filter(Boolean);
        return (
          <View key={i} style={s.projItem} wrap={false}>
            {clean(p.name) ? <Text style={s.projName}>{clean(p.name)}</Text> : null}
            {bullets.map((b, bi) => (
              <Bullet key={bi} text={b} s={s} />
            ))}
          </View>
        );
      })}
    </View>
  );
}

function ContactBlock({ b, s }: { b: ResumeProfile["basics"]; s: Styles }) {
  const items = [
    { label: "Email", value: clean(b.email) },
    { label: "Phone", value: clean(b.phone) },
    { label: "Location", value: clean(b.location) },
    { label: "LinkedIn", value: clean(b.linkedin) },
  ].filter((x) => x.value);
  if (!items.length) return null;
  return (
    <View style={s.sidebarSection}>
      <Text style={s.sectionTitle}>Contact</Text>
      {items.map((x, i) => (
        <View key={i} style={{ marginBottom: 5 }}>
          <Text style={s.contactLabel}>{x.label}</Text>
          <Text style={s.contactItem}>{x.value}</Text>
        </View>
      ))}
    </View>
  );
}

function ChipList({ title, values, s }: { title: string; values: string[]; s: Styles }) {
  const rows = nonEmpty(values);
  if (!rows.length) return null;
  return (
    <View style={s.sidebarSection}>
      <Text style={s.sectionTitle}>{title}</Text>
      {rows.map((v, i) => (
        <Text key={i} style={s.chip}>
          {v}
        </Text>
      ))}
    </View>
  );
}

function SidebarEducation({ items, s }: { items: ResumeEducation[]; s: Styles }) {
  const rows = items.filter((e) => clean(e.degree) || clean(e.institution));
  if (!rows.length) return null;
  return (
    <View style={s.sidebarSection}>
      <Text style={s.sectionTitle}>Education</Text>
      {rows.map((e, i) => {
        const meta = nonEmpty([e.institution, e.dates]).join(", ");
        return (
          <View key={i} style={{ marginBottom: 6 }}>
            {clean(e.degree) ? <Text style={s.sidebarEduDegree}>{clean(e.degree)}</Text> : null}
            {meta ? <Text style={s.sidebarEduMeta}>{meta}</Text> : null}
          </View>
        );
      })}
    </View>
  );
}

/* ── The document ─────────────────────────────────────────────────────────── */

function CvDocument({
  profile,
  targetRole,
  pageSize,
  theme,
}: {
  profile: ResumeProfile;
  targetRole: string;
  pageSize: "A4" | "LETTER";
  theme: DesignedCvTheme;
}) {
  const s = makeStyles(theme);
  const b = profile.basics || ({} as ResumeProfile["basics"]);
  const roleLine = clean(targetRole) || clean(b.headline);
  const summary = clean(profile.summary);

  return (
    <Document
      title={clean(b.name) ? `${clean(b.name)} CV` : "WorkZo CV"}
      author={clean(b.name) || "WorkZo AI"}
    >
      <Page size={pageSize} style={s.page} wrap>
        <View style={s.sidebarBand} fixed />
        <View style={s.body}>
          {/* Left column: the scannable facts. */}
          <View style={s.sidebar}>
            <ContactBlock b={b} s={s} />
            <ChipList title="Skills" values={profile.skills || []} s={s} />
            <ChipList title="Languages" values={profile.languages || []} s={s} />
            <ChipList title="Certifications" values={profile.certifications || []} s={s} />
            <SidebarEducation items={profile.education || []} s={s} />
          </View>

          {/* Right column: the narrative. */}
          <View style={s.main}>
            {clean(b.name) ? <Text style={s.name}>{clean(b.name)}</Text> : null}
            {roleLine ? <Text style={s.role}>{roleLine}</Text> : null}
            <View style={s.headerRule} />

            {summary ? (
              <View style={s.mainSection}>
                <Text style={s.sectionTitle}>Summary</Text>
                <Text style={s.summary}>{summary}</Text>
              </View>
            ) : null}

            <ExperienceBlock items={profile.experience || []} s={s} />
            <ProjectsBlock items={profile.projects || []} s={s} />
          </View>
        </View>
      </Page>
    </Document>
  );
}

/* ── Public API: mirrors buildCvDocxBytes, async because rendering is async ── */

export async function buildDesignedCvPdfBytes(
  profile: ResumeProfile,
  targetRoleOrOptions: string | DesignedCvOptions = "",
): Promise<Uint8Array> {
  ensureFonts();

  const options: DesignedCvOptions =
    typeof targetRoleOrOptions === "string"
      ? { targetRole: targetRoleOrOptions }
      : targetRoleOrOptions;

  const theme: DesignedCvTheme = { ...DEFAULT_THEME, ...(options.theme || {}) };
  const pageSize = options.pageSize || "A4";
  const targetRole = clean(options.targetRole);

  const buffer = await renderToBuffer(
    <CvDocument profile={profile} targetRole={targetRole} pageSize={pageSize} theme={theme} />,
  );
  return new Uint8Array(buffer);
}
