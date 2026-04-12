# IITJ Student Profile Intelligence System

## Abstract
This project proposes an end-to-end data engineering platform for extracting, organizing, and analyzing IIT Jodhpur student profile data from directory sources and public professional signals. The system ingests structured contact data, normalizes and deduplicates records, stores them in a relational database, and exposes a web application for profile search, ranking, resume analysis, and social-link enrichment. It also supports authenticated profile claiming so students can manage their own public profile information. The project demonstrates a full data pipeline covering acquisition, transformation, storage, analytics, caching, and interactive visualization.

## Problem Statement
Student professional information is typically fragmented across directories, resumes, and public profiles, which makes it difficult to search, compare, and improve. Existing tools rarely combine structured ingestion, resume intelligence, ranking, and profile enrichment in a single workflow. This project addresses that gap by building a unified platform that helps students understand and improve their online presence while giving the institution a scalable profile intelligence layer.

## Objectives
1. Extract student data from directory sources and normalize it into a consistent schema.
2. Build a searchable interface for locating students by name, email, or roll number.
3. Analyze resume content and generate actionable improvement suggestions.
4. Aggregate public profile signals and social links into a student intelligence view.
5. Rank student profiles using measurable activity and profile-strength indicators.
6. Support authenticated profile claiming and self-managed social links.
7. Cache analytical outputs to reduce repeated processing and improve response time.

## Methodology
The system follows a pipeline-based architecture. First, contact data is collected from directory sources and cleaned to remove non-student or duplicate entries. Next, the data is stored in a PostgreSQL database using a normalized schema with relations for students, social links, feedback, cached analyses, reactions, upvotes, and resumes. The backend provides APIs for search, ranking, resume upload, profile analysis, and profile management. The frontend presents a mobile-friendly dashboard where users can search for profiles, inspect rankings, upload resumes, and view improvement feedback.

## Data Engineering Contribution
The project is not only a web application; it is a data engineering system. It includes data ingestion, filtering, deduplication, schema design, incremental updates, analytics caching, and ranked retrieval. The resume-processing path converts uploaded documents into text, scores them against a rubric, and stores the results for repeat access. The analysis layer combines database records with verified public signals to generate reproducible profile summaries.

## Expected Outcomes
1. A structured and searchable IITJ student profile database.
2. A resume intelligence module that returns scores and improvement suggestions.
3. A ranking and leaderboard system for profile visibility and activity.
4. A claim-and-edit workflow for students to manage their own profiles.
5. A deployable application that demonstrates a complete data pipeline from ingestion to visualization.

## Evaluation Plan
The project can be evaluated using extraction accuracy, deduplication quality, query latency, resume parsing success rate, cache hit rate, and user engagement metrics such as searches and profile updates. A short qualitative evaluation can also be included to show how useful the resume recommendations and profile summaries are for students.

## Ethical and Privacy Considerations
The project should be presented as a public-profile and self-improvement tool, not as a surveillance system. Only publicly available or user-authorized information should be used. Sensitive fields should be minimized, students should be able to claim or correct their profiles, and any ranking should be described as a heuristic rather than an absolute measure of merit.

## Future Scope
Future enhancements may include more robust source connectors, richer document parsing, better ranking explanations, trend tracking over time, opt-out controls, and department-level analytics dashboards.

