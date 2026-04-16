---
title: "IITJ Student Profile Intelligence System (Scouter)"
author: "Chirag Phor (M25DE1021)"
date: "April 2026"
---

# IITJ Student Profile Intelligence System (Scouter)

## 1. Project Information
**Course:** Machine Learning with Big Data
**Project Title:** IITJ Student Profile Intelligence System (Scouter)

### Team Members and Contributions
* **Chirag Phor (Roll Number: M25DE1021)**
  * **Individual Contributions:** 
    * Entire end-to-end architecture setup and system design.
    * Implemented data ingestion scripts and deduplication logic (Python scripts to normalize structure).
    * Designed the normalized PostgreSQL schema and setup ORM configurations using Drizzle.
    * Developed the frontend interface (React/Next.js) including the mobile-friendly dashboard.
    * Embedded the ML/AI-assisted tools for resume parsing, intelligence, scoring, and metadata caching.
    * Handled all code cleanliness refactoring, automated linting setups, and deployment configuration via Docker. 

## 2. Abstract
This project proposes and implements an end-to-end data engineering platform for extracting, organizing, and analyzing IIT Jodhpur student profile data from directory sources and public professional signals. The system ingests structured contact data, normalizes and deduplicates records, stores them in a relational database, and exposes a web application for profile search, ranking, resume analysis, and social-link enrichment. The project demonstrates a full data pipeline covering acquisition, transformation, storage, analytics, caching, and interactive visualization.

## 3. Problem Statement
Student professional information is typically fragmented across directories, resumes, and public profiles, making it difficult to search, compare, and improve. Existing tools rarely combine structured ingestion, resume intelligence, ranking, and profile enrichment into a single cohesive workflow. Scouter addresses that gap by building a unified platform helping students understand and improve their online professional presence while seamlessly giving the institution a highly scalable profile intelligence layer.

## 4. Objectives & Scope
The key objectives of this system include:
1. Extracting student data from directory sources iteratively and normalizing it into a uniform schema.
2. Providing a highly searchable interface for locating students by name, email, or roll number.
3. Analyzing resume content using intelligent, ML-backed rubric extraction to generate actionable improvement suggestions.
4. Aggregating public profile signals and social links into a unified student intelligence view.
5. Ranking student profiles using measurable activity and dynamic profile-strength indicators.
6. Supporting authenticated profile claiming (so individuals manage their own links and privacy).
7. Caching analytical logic outputs locally to drastically reduce repeated document processing and improve latency.

## 5. System Architecture and Methodology
Scouter follows a rigorous, pipeline-based data engineering architecture:

1. **Ingestion & Normalization:** Contact data is collected from institutional directory sources. It passes through cleaning modules to filter out non-student entries and gracefully resolve duplications prior to storage.
2. **Storage:** The deduplicated structured data is committed to a scalable PostgreSQL database using a fully normalized schema encompassing relations for users, social links, activity (cached analyses, upvotes, responses), and document blobs.
3. **Analytics & ML Engine:** A resume-processing path dynamically converts uploaded binary documents into text. It then applies an AI scoring metric against a standardized rubric, returning both a quantitative score and qualitative actionable feedback.
4. **Caching & Retrieval:** The analysis layer aggregates database records augmented by public signals and caches computational summaries, ensuring subsequent UI requests remain performant and scalable.

## 6. Code Cleanliness & Quality Evaluation Focus
The system was architected with a strong emphasis on maintainability, modularity, and data cleanliness:
- **Consistent Schema Definitions:** All storage constraints cleanly specified using rigorous relational constraints (Foreign Key cascading, indexing on high-frequency search fields).
- **Extensible API Routing:** Endpoints decoupled logically corresponding to distinct bounded contexts (e.g., student lookup, resume upload, auth, caching).
- **Linting & Best Best Practices:** Adherence to standard idiomatic patterns to ensure long-term readability and minimum technical debt over time.
- **Accuracy Measurements:** Tracked qualitative metrics for ingestion coverage, extraction accuracy, deduplication fidelity, and fast query execution latencies for the resulting search frontend.

## 7. Expected Outcomes and Demonstration Overview
The platform seamlessly achieves a centralized, structured, and searchable IITJ profile hub encompassing:
- Robust API endpoints handling large sets of multi-dimensional profile queries seamlessly.
- An ML-based resume intelligence scoring model deployed in real-time, capable of highlighting missing standard sections.
- Verified profiles ensuring accurate platform integrity, combined with leaderboard structures promoting peer engagement.

## 8. Ethical & Privacy Considerations
Throughout execution, paramount attention is given to data privacy. Features use entirely publicly-facing attributes or deliberately authorized records. Scouter focuses strictly on constructive intelligence (improvement analytics) rather than surveillance, with scoring representing only heuristic approximations of document strength and profile completeness.

## 9. Future Scope
Planned enhancements entail deploying expansive graph algorithms to measure peer cluster relations natively, adopting more advanced NLP architectures for granular resume recommendations, and supporting fully opted-out granular visibility controls.
