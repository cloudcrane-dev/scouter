---
marp: true
theme: default
paginate: true
header: "IITJ Student Profile Intelligence System"
footer: "Machine Learning with Big Data | Chirag Phor (M25DE1021)"
---

# IITJ Student Profile Intelligence System (Scouter)

**Course:** Machine Learning with Big Data  
**Team Member:** Chirag Phor (Roll Number: M25DE1021)

---

## 1. Background of the Problem

- Student profile data is fundamentally scattered.
- **Sources:** Directory files, disconnected resumes, diverse public online platforms (LinkedIn, GitHub).
- **Challenge:** Difficult for students to effectively search, compare, and holistically improve their professional brand natively within a single university ecosystem.

---

## 2. Problem Definition

Build an interactive, highly-scalable software system that:
- Automatically **extracts, deduplicates, and stores** institutional profile data.
- **Enriches** sparse records asynchronously with public professional signals.
- **Analyzes** student profile data while simultaneously enabling intelligent resume review and scoring feedback.

---

## 3. Importance of the Problem

- **For Students:** Provides an actionable, practical way to actively understand their online presence, improve their resumes, and manage verified profile information cohesively.
- **For Analytics:** Simplifies directory searches and standardizes the process of measuring aggregate institutional employment strength based on Big Data patterns.

---

## 4. Existing Work in this Direction

Current platforms typically fall inherently short:
- **Directory Portals:** Purely search-based, missing intelligence or analytics.
- **Resume Scorers:** Disconnected single-purpose utilities lacking profile context.
- **Profile Platforms:** Closed ecosystems unable to directly ingest university directory records properly.
- **Failure:** Existing tools fail to efficiently integrate ingestion, analysis, and active ranking directly end-to-end.

---

## 5. Objectives & Scope

1. **Extract** vast quantities of unstructured data iteratively and normalize it uniformly.
2. Enable lightning-fast programmatic **Search Capability** across multidimensional fields.
3. Automatically **Analyze Resumes** using AI-based intelligence and output rubric-driven suggestions.
4. Intelligently **Rank Profiles** using heuristically measurable activity.
5. Provide a system to enable verified profile **Claiming & Self-management**.
6. Aggressively **Cache Insights** maximizing speed under high load environments.

---

## 6. System Architecture & Big Data Pipeline

- **Data Ingestion:** Large-scale extraction from directory structures filtering invalid elements.
- **Database Schema Storage:** PostgreSQL/Drizzle managing relationships mapping users, analytics, social links, and cached aggregates seamlessly without redundancy.
- **Analytics Service:** Web app connecting real-time ML-scored insights across student document inputs continuously mapping improvements against a dynamic standard rubric.

---

## 7. Individual Contributions & Quality Evaluation
**Contributors:** Chirag Phor (M25DE1021) 
- Evaluated and defined uniform schema requirements, leading database structuring natively (PostgreSQL).
- Integrated core machine-learning evaluation pipelines bridging PDF extractions seamlessly with web views. 
- Prioritized robust code cleanliness leveraging modern TypeScript paradigms enforcing strong typings implicitly averting runtime collisions effectively. 

---

## 8. Expected Outcomes & Demonstration

- A structured, deployable **Searchable Intelligence Platform**.
- Dynamic **AI Resume Scoring Framework** directly pointing out weak spots intuitively.
- Engaging **Leaderboard Ranking System** enforcing participation safely.
- A functionally complete robust **Data Engineering Pipeline**.

---

## 9. Conclusion & Future Scope

- **Success:** Transforms isolated user metadata into cohesive structured insights actively assisting professional improvement directly.
- **Future Enhancements:** 
  - Richer document parsing logic parsing multi-column academic resumes accurately.
  - Transparent opt-out access controls natively embedded via Blockchain logic dynamically.
  - Granular department-level analytics dashboards effectively tracking institutional hiring trajectories systematically. 
