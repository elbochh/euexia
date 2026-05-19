# Euexia Model Workflow Benchmark

Generated: 2026-05-18T20:03:52.682Z

## Purpose

This benchmark tests whether Gemma 4 is a strong practical model for Euexia's post-consultation workflow compared with a frontier reference model. The experiment uses the same UH Bristol discharge summary PDF and runs the core agentic workflow:

1. Extract PDF text locally with `pdf-parse`.
2. Ask the model to produce a detailed discharge-summary extraction.
3. Run deterministic medication pre-extraction.
4. Ask the model to produce a patient-friendly care plan.
5. Ask the model to generate scheduled checklist events as JSON.
6. Parse and score the checklist for medication recall, follow-up recall, schedule signals, JSON validity, and latency.

## Input

- PDF: `C:\Users\jasem\Downloads\UH Bristol Electronic Discharge Summary Sample (1).pdf`
- Extracted PDF parse time: 102 ms

## Summary

Across 5 run(s), Gemma 4 averaged 20,910 ms; GPT-5.4 mini averaged 47,218 ms. Gemma 4 was 2.26x faster on average.

Gemma 4 achieved medication-perfect checklist generation in 5/5 runs and full-detail pass in 0/5 runs. GPT-5.4 mini achieved medication-perfect checklist generation in 5/5 runs and full-detail pass in 0/5 runs.

Estimated average workflow cost was $0.00284 for Gemma 4 and $0.04290 for GPT-5.4 mini; Gemma 4 was about 15.1x cheaper using the listed token rates.

The key interpretation for the Kaggle submission should be conservative: this is not a universal LLM benchmark. It is a task-specific Euexia benchmark for post-consultation care-plan extraction and checklist generation.

## Results Table

| Model | Model ID | Completed | JSON valid | Medication-perfect | Checklist-quality pass | Full-detail pass | Avg ms | Min ms | Max ms | Avg input tokens | Avg output tokens | Avg total tokens | Avg cost | Total cost |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Gemma 4 | google/gemma-4-26b-a4b-it-maas | 5/5 | 5/5 | 5/5 | 4/5 | 0/5 | 20,910 | 18,178 | 22,352 | 3,212 | 3,925 | 7,137 | $0.00284 | $0.01418 |
| GPT-5.4 mini | gpt-5.4-mini | 5/5 | 5/5 | 5/5 | 0/5 | 0/5 | 47,218 | 40,573 | 52,690 | 3,329 | 8,979 | 12,308 | $0.04290 | $0.21451 |

## Per-Run Results

| Model | Model ID | Run | Completed | Total ms | PDF summary ms | Care plan ms | Checklist ms | Input tokens | Output tokens | Total tokens | Est. cost | JSON valid | Events | Single-med events | Grouped-med events | Duplicate titles | Medication recall | Follow-up recall | Extra med signals |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Gemma 4 | google/gemma-4-26b-a4b-it-maas | 1 | yes | 21,444 | 4,023 | 1,915 | 15,504 | 3,203 | 3,931 | 7,134 | $0.00284 | yes | 20 | 10 | 0 | 1 | 10/10 | 3/6 | 0 |
| GPT-5.4 mini | gpt-5.4-mini | 1 | yes | 40,573 | 6,387 | 3,768 | 30,417 | 3,338 | 7,900 | 11,238 | $0.03805 | yes | 39 | 30 | 0 | 20 | 10/10 | 5/6 | 0 |
| Gemma 4 | google/gemma-4-26b-a4b-it-maas | 2 | yes | 18,178 | 4,066 | 2,018 | 12,094 | 3,217 | 3,467 | 6,684 | $0.00256 | yes | 16 | 10 | 0 | 0 | 10/10 | 3/6 | 0 |
| GPT-5.4 mini | gpt-5.4-mini | 2 | yes | 50,349 | 6,063 | 3,719 | 40,566 | 3,242 | 9,664 | 12,906 | $0.04592 | yes | 69 | 69 | 0 | 59 | 10/10 | 5/6 | 0 |
| Gemma 4 | google/gemma-4-26b-a4b-it-maas | 3 | yes | 21,092 | 4,051 | 2,245 | 14,795 | 3,222 | 4,000 | 7,222 | $0.00288 | yes | 20 | 10 | 0 | 0 | 10/10 | 3/6 | 0 |
| GPT-5.4 mini | gpt-5.4-mini | 3 | yes | 52,690 | 5,914 | 6,121 | 40,655 | 3,184 | 9,713 | 12,897 | $0.04610 | yes | 66 | 66 | 0 | 56 | 10/10 | 5/6 | 0 |
| Gemma 4 | google/gemma-4-26b-a4b-it-maas | 4 | yes | 22,352 | 3,952 | 1,932 | 16,467 | 3,196 | 4,216 | 7,412 | $0.00301 | yes | 22 | 10 | 0 | 0 | 10/10 | 3/6 | 0 |
| GPT-5.4 mini | gpt-5.4-mini | 4 | yes | 44,070 | 7,786 | 4,135 | 32,148 | 3,616 | 7,941 | 11,557 | $0.03845 | yes | 50 | 43 | 0 | 33 | 10/10 | 6/6 | 0 |
| Gemma 4 | google/gemma-4-26b-a4b-it-maas | 5 | yes | 21,483 | 4,072 | 2,236 | 15,174 | 3,223 | 4,009 | 7,232 | $0.00289 | yes | 20 | 10 | 0 | 0 | 10/10 | 3/6 | 0 |
| GPT-5.4 mini | gpt-5.4-mini | 5 | yes | 48,409 | 5,801 | 4,231 | 38,375 | 3,266 | 9,676 | 12,942 | $0.04599 | yes | 52 | 46 | 0 | 36 | 10/10 | 4/6 | 0 |

## Notes On Model Selection

- Gemma 4 is the implementation model used by Euexia through Vertex AI Model-as-a-Service.
- Gemini 3 Pro Preview can be used as a high-capability Google reference model when project access permits.
- GPT-5.4 mini can be included as an external frontier-reference model by setting `OPENAI_API_KEY` and running with `--include-openai`.
- GPT-5.4 mini cost estimate uses OpenAI's public API pricing: $0.75 / 1M input tokens and $4.50 / 1M output tokens.
- Gemma 4 cost estimate uses the public LLMReference listing for Gemma 4 26B A4B on GCP Vertex AI: $0.15 / 1M input tokens and $0.60 / 1M output tokens. Treat this as an estimate unless confirmed in Google Cloud billing.
- If `gemini-3-pro-preview` is unavailable in the project, rerun with `GEMINI_VERTEX_MODEL=gemini-3-flash-preview` and label the comparison as Gemini 3 Flash rather than Gemini 3 Pro.

## Gemma 4

- Model: `google/gemma-4-26b-a4b-it-maas`
- Completed: yes
- Total workflow time: 21,444 ms
- Total input tokens: 3,203
- Total output tokens: 3,931
- Total tokens: 7,134
- Estimated cost: $0.00284
- Pricing source: third-party Vertex Gemma listing; confirm with Google Cloud billing
- Medication recall: 10/10
- Follow-up recall: 3/6
- JSON valid: yes
- Events generated: 20
- Medication events generated: 10
- Single-medication events: 10
- Grouped-medication events: 0
- Duplicate checklist titles: 1
- Two-week medication course preserved: yes
- Twice-daily medication signal preserved: yes
- Simvastatin nightly signal preserved: yes
- INR monitoring signal preserved: yes
- Missing medications: none
- Missing follow-up items: Contact Dr Deep if Hb falls below 8.00, 6 week follow-up with Dr Wide, 8 week follow-up with Dr Deep
- Possible extra medication-like checklist titles: none

### Sample generated checklist events

```text
1. Take Bisoprolol - 2.5mg orally, once daily for 14 days.
2. Take Alendronic Acid - 70mg orally, once daily for 14 days.
3. Take Adcal-D3 - Two tablets orally, twice daily for 14 days.
4. Take Omeprazole - 40mg orally, once daily for 14 days.
5. Use Glyceryl Trinitrate - 400 micrograms sublingual spray, two doses when required.
6. Take Warfarin Sodium - Dose determined by INR, once daily for 14 days.
7. Take Folic Acid - 5mg orally, twice daily for 14 days to raise iron levels.
8. Take Ramipril - 7.5mg orally, once daily for 14 days.
9. Take Simvastatin - 40mg orally, every night for 14 days.
10. Take Gliclazide m/r - 120mg orally, once daily for 14 days.
11. Monitor Hb Levels - Contact Dr. Deep immediately if Hb falls below 8.00.
12. Check INR - GP to check INR to determine Warfarin dose.
```

### Care-plan excerpt

```text
Your care plan following your admission for left ventricular failure and iron-deficient anaemia (with a noted episode of melaena and diverticular disease) is as follows: Please take the following medications for the next two weeks unless otherwise specified: Bisoprolol 2.5mg once daily orally (pharmacy to dispense), Alendronic Acid 70mg once daily orally (pharmacy to dispense), Adcal-D3 two tablets twice daily orally (stop once the course is finished), Omeprazole 40mg once daily orally, Glyceryl Trinitrate 400 micrograms (two doses when required via sublingual spray), Warfarin Sodium once daily orally at the dose determined by your INR (GP to check INR), Folic Acid 5mg twice daily orally (increased to help raise your iron level), Ramipril 7.5mg once daily orally, Simvastatin 40mg every night orally, and Gliclazide m/r 120mg once daily orally. Your GP is requested to review all medications and repeat your Full Blood Count (FBC) every two weeks; please contact Dr. Deep immediately if your Hb falls below 8.00. Regarding follow-up, you have hospital outpatient appointments scheduled in 6 weeks with Dr. Wide and in 8 weeks with Dr. Deep. Outstanding investigations include a colonoscopy and an appointment with the Queen Days Unit. You have been referred to Occupational Therapy and Physiotherapy, and home oxygen equipment is to be arranged. Due to your visual impairment, please ensure all instructions are provided in a large font.
```

## GPT-5.4 mini

- Model: `gpt-5.4-mini`
- Completed: yes
- Total workflow time: 40,573 ms
- Total input tokens: 3,338
- Total output tokens: 7,900
- Total tokens: 11,238
- Estimated cost: $0.03805
- Pricing source: OpenAI official pricing page
- Medication recall: 10/10
- Follow-up recall: 5/6
- JSON valid: yes
- Events generated: 39
- Medication events generated: 30
- Single-medication events: 30
- Grouped-medication events: 0
- Duplicate checklist titles: 20
- Two-week medication course preserved: yes
- Twice-daily medication signal preserved: yes
- Simvastatin nightly signal preserved: yes
- INR monitoring signal preserved: yes
- Missing medications: none
- Missing follow-up items: Repeat FBC every two weeks
- Possible extra medication-like checklist titles: none

### Sample generated checklist events

```text
1. Take Glyceryl Trinitrate - 400 micrograms sublingually, use when required, for 2 weeks; place under the tongue for chest pain and review use.
2. Take Warfarin - Dose as per INR by mouth, once daily, for 2 weeks; take exactly as directed and check INR.
3. Take Alendronic Acid - 70 mg by mouth, once daily, for 2 weeks; take as instructed and please review.
4. Take Simvastatin - 40 mg by mouth, every night, for 2 weeks; take at bedtime and please review.
5. Take Bisoprolol - 2.5 mg by mouth, once daily, for 2 weeks; take as prescribed and please review.
6. Take Gliclazide - 120 mg modified-release by mouth, once daily, for 2 weeks; take with food and please review.
7. Take Omeprazole - 40 mg by mouth, once daily, for 2 weeks; take before food and please review.
8. Take Ramipril - 7.5 mg by mouth, once daily, for 2 weeks; take as prescribed and please review.
9. Take Adcal-D3 - 2 tablets by mouth, twice daily, for 2 weeks; take with food and stop after the course is finished.
10. Take Folic Acid - 5 mg by mouth, twice daily, for 2 weeks; take as directed to raise the iron level and please review.
11. Take Glyceryl Trinitrate - 400 micrograms sublingually, use when required, for 2 weeks; place under the tongue for chest pain and review use.
12. Take Warfarin - Dose as per INR by mouth, once daily, for 2 weeks; take exactly as directed and check INR.
```

### Care-plan excerpt

```text
You were admitted to UHBristol NHS on 19/01/09 with dyspnoea and chest pain and were found to be in pulmonary oedema; your primary diagnosis was left ventricular failure and you also had iron-deficient anaemia, with an episode of melaena during admission. Tests/procedures showed a negative troponin, CT colonography was performed, OGD showed iron-stained stool only and diverticular disease, and colonoscopy could not be performed because of increased shortness of breath; an outstanding hospital investigation is to arrange a colonoscopy. You improved on Bipap, Isoket and Frusemide, and there was no change in treatment rationale. Please take your discharge medicines for 2 weeks unless stated otherwise: Glyceryl Trinitrate 400 micrograms per dose sublingually, two doses when required (please review); Warfarin Sodium once daily by mouth as per INR for 2 weeks (check INR); Alendronic Acid 70 mg once daily by mouth for 2 weeks (please review); Simvastatin 40 mg every night by mouth for 2 weeks (please review); Bisoprolol 2.5 mg once daily by mouth for 2 weeks (please review); Gliclazide m/r 120 mg once daily by mouth for 2 weeks (please review); Omeprazole 40 mg once daily by mouth for 2 weeks (please review); Ramipril 7.5 mg once daily by mouth for 2 weeks (please review); Adcal-D3 two tablets twice daily by mouth for 2 weeks, then stop after the course is finished; and folic acid to be increased to raise the iron level, with folic acid 5 mg twice daily by mouth for 2 weeks (please review). Your GP should repeat FBC every 2 weeks, increase folic acid to raise the iron level, and contact Dr Deep if your Hb falls below 8.00. Follow up is arranged with Dr Wide in 6 weeks and Dr Deep in 8 weeks, and Queen Days Unit is to be arranged; you have also been referred to Occupational The
```

## Gemma 4

- Model: `google/gemma-4-26b-a4b-it-maas`
- Completed: yes
- Total workflow time: 18,178 ms
- Total input tokens: 3,217
- Total output tokens: 3,467
- Total tokens: 6,684
- Estimated cost: $0.00256
- Pricing source: third-party Vertex Gemma listing; confirm with Google Cloud billing
- Medication recall: 10/10
- Follow-up recall: 3/6
- JSON valid: yes
- Events generated: 16
- Medication events generated: 10
- Single-medication events: 10
- Grouped-medication events: 0
- Duplicate checklist titles: 0
- Two-week medication course preserved: yes
- Twice-daily medication signal preserved: yes
- Simvastatin nightly signal preserved: yes
- INR monitoring signal preserved: yes
- Missing medications: none
- Missing follow-up items: Contact Dr Deep if Hb falls below 8.00, 6 week follow-up with Dr Wide, 8 week follow-up with Dr Deep
- Possible extra medication-like checklist titles: none

### Sample generated checklist events

```text
1. Take Bisoprolol - 2.5mg orally, once daily for 14 days. GP to review.
2. Take Alendronic Acid - 70mg orally, once daily for 14 days. GP to review.
3. Take Adcal-D3 - Two tablets orally, twice daily for 14 days. Stop after course is finished.
4. Take Omeprazole - 40mg orally, once daily for 14 days. GP to review.
5. Use Glyceryl Trinitrate - 400 micrograms sublingual spray, up to two doses when required. GP to review.
6. Take Warfarin Sodium - Dose determined by INR, once daily for 14 days. GP to check INR.
7. Take Folic Acid - 5mg orally, twice daily for 14 days. Increased to raise iron levels. GP to review.
8. Take Ramipril - 7.5mg orally, once daily for 14 days. GP to review.
9. Take Simvastatin - 40mg orally, every night for 14 days. GP to review.
10. Take Gliclazide m/r - 120mg orally, once daily for 14 days. GP to review.
11. Monitor Hb Levels - Contact Dr. Deep immediately if Hb falls below 8.00.
12. Full Blood Count Test - Repeat FBC every two weeks.
```

### Care-plan excerpt

```text
Your care plan following your admission for left ventricular failure, pulmonary oedema, and iron-deficient anaemia (with diverticular disease noted via OGD) involves several important steps. Please take the following medications for the next two weeks unless otherwise specified: Bisoprolol 2.5mg once daily orally (GP to review), Alendronic Acid 70mg once daily orally (GP to review), Adcal-D3 two tablets twice daily orally (stop after course is finished), Omeprazole 40mg once daily orally (GP to review), Glyceryl Trinitrate 400 micrograms per dose via sublingual spray (up to two doses when required; GP to review), Warfarin Sodium once daily orally at the dose determined by your INR (GP to check INR), Folic Acid 5mg twice daily orally (increased to raise iron levels; GP to review), Ramipril 7.5mg once daily orally (GP to review), Simvastatin 40mg every night orally (GP to review), and Gliclazide m/r 120mg once daily orally (GP to review). For monitoring, you must have a repeat Full Blood Count (FBC) every two weeks, and you must contact Dr. Deep immediately if your Hb falls below 8.00. Your follow-up includes outpatient appointments with Dr. Wide in 6 weeks and Dr. Deep in 8 weeks, as well as upcoming arrangements for a colonoscopy and the Queen Days Unit. Referrals have been made to Occupational Therapy and Physiotherapy, and you will be provided with home oxygen equipment. Due to your visual impairment, please ensure the pharmacy prints all medication instructions in a large font.
```

## GPT-5.4 mini

- Model: `gpt-5.4-mini`
- Completed: yes
- Total workflow time: 50,349 ms
- Total input tokens: 3,242
- Total output tokens: 9,664
- Total tokens: 12,906
- Estimated cost: $0.04592
- Pricing source: OpenAI official pricing page
- Medication recall: 10/10
- Follow-up recall: 5/6
- JSON valid: yes
- Events generated: 69
- Medication events generated: 69
- Single-medication events: 69
- Grouped-medication events: 0
- Duplicate checklist titles: 59
- Two-week medication course preserved: yes
- Twice-daily medication signal preserved: yes
- Simvastatin nightly signal preserved: yes
- INR monitoring signal preserved: yes
- Missing medications: none
- Missing follow-up items: Repeat FBC every two weeks
- Possible extra medication-like checklist titles: none

### Sample generated checklist events

```text
1. Take GTN - 400 micrograms per dose, sublingual, use when needed for 2 weeks, may take up to 2 doses and review if chest pain persists.
2. Take Warfarin - As prescribed per INR, oral, once daily for 2 weeks, check INR before dose.
3. Take Alendronic Acid - 70 mg, oral, once daily for 2 weeks, please review and take exactly as prescribed.
4. Take Bisoprolol - 2.5 mg, oral, once daily for 2 weeks, please review and do not stop abruptly.
5. Take Gliclazide - 120 mg modified-release, oral, once daily for 2 weeks, please review and take with food.
6. Take Omeprazole - 40 mg, oral, once daily for 2 weeks, please review and take before food.
7. Take Ramipril - 7.5 mg, oral, once daily for 2 weeks, please review and monitor for dizziness.
8. Take Folic Acid - 5 mg, oral, twice daily for 2 weeks, please review and continue to help raise iron level.
9. Take Adcal-D3 - 2 tablets, oral, twice daily for 2 weeks, stop when the course is finished.
10. Take Simvastatin - 40 mg, oral, every night for 2 weeks, please review and take at bedtime.
11. Take Warfarin - As prescribed per INR, oral, once daily for 2 weeks, check INR before dose.
12. Take Alendronic Acid - 70 mg, oral, once daily for 2 weeks, please review and take exactly as prescribed.
```

### Care-plan excerpt

```text
LEX LUTHER (Hospital No. RA70006014, DOB 05/06/1974) was admitted on 19/01/09 with dyspnoea and chest pain and had pulmonary oedema and an episode of melaena; the diagnoses were left ventricular failure and iron-deficient anaemia, with troponin negative, OGD showing iron-stained stool only and diverticular disease, colonoscopy not possible because of increased SOB, CT colonography performed, and a colonoscopy still to be arranged; he improved with Bipap, Isoket, and Frusemide, has no known allergies, was MRSA negative and C. difficile negative, and has home oxygen, with all instructions to be printed in large font because he is partially blind. Please repeat FBC every 2 weeks and contact Dr Deep if Hb falls below 8.0. Follow up is arranged with Dr Wide in 6 weeks and Dr Deep in 8 weeks, with Queen Days Unit to be arranged, and he has occupational and physiotherapy referrals and was seen by the community team. His discharge medicines are: Glyceryl Trinitrate 400 micrograms per dose, 2 doses, sublingual when required for 2 weeks, please review; Warfarin Sodium as per INR once daily orally for 2 weeks, check INR; Alendronic Acid 70 mg once daily orally for 2 weeks, please review; Simvastatin 40 mg every night orally for 2 weeks, please review; Bisoprolol 2.5 mg once daily orally for 2 weeks, please review; Gliclazide m/r 120 mg once daily orally for 2 weeks, please review; Omeprazole 40 mg once daily orally for 2 weeks, please review; Folic acid increased to raise the iron level, 5 mg twice daily orally for 2 weeks, please review; Ramipril 7.5 mg once daily orally for 2 weeks, please review; and Adcal-D3 two tablets twice daily orally for 2 weeks, then stop when the course is finished.
```

## Gemma 4

- Model: `google/gemma-4-26b-a4b-it-maas`
- Completed: yes
- Total workflow time: 21,092 ms
- Total input tokens: 3,222
- Total output tokens: 4,000
- Total tokens: 7,222
- Estimated cost: $0.00288
- Pricing source: third-party Vertex Gemma listing; confirm with Google Cloud billing
- Medication recall: 10/10
- Follow-up recall: 3/6
- JSON valid: yes
- Events generated: 20
- Medication events generated: 10
- Single-medication events: 10
- Grouped-medication events: 0
- Duplicate checklist titles: 0
- Two-week medication course preserved: yes
- Twice-daily medication signal preserved: yes
- Simvastatin nightly signal preserved: yes
- INR monitoring signal preserved: yes
- Missing medications: none
- Missing follow-up items: Contact Dr Deep if Hb falls below 8.00, 6 week follow-up with Dr Wide, 8 week follow-up with Dr Deep
- Possible extra medication-like checklist titles: none

### Sample generated checklist events

```text
1. Take Bisoprolol - 2.5mg orally, once daily for 14 days. GP to review.
2. Take Alendronic Acid - 70mg orally, once daily for 14 days. GP to review.
3. Take Adcal-D3 - Two tablets orally, twice daily until course finished.
4. Take Omeprazole - 40mg orally, once daily for 14 days. GP to review.
5. Use Glyceryl Trinitrate - 400 micrograms sublingual spray, two doses when required. GP to review.
6. Take Warfarin Sodium - Dose determined by INR, once daily orally. GP to check INR.
7. Take Folic Acid - 5mg orally, twice daily for 14 days. GP to review.
8. Take Ramipril - 7.5mg orally, once daily for 14 days. GP to review.
9. Take Simvastatin - 40mg orally, every night for 14 days. GP to review.
10. Take Gliclazide m/r - 120mg orally, once daily for 14 days. GP to review.
11. Monitor Hb Levels - Contact Dr. Deep immediately if Hb falls below 8.00.
12. Full Blood Count (FBC) - Repeat FBC every two weeks.
```

### Care-plan excerpt

```text
Your care plan following your admission for left ventricular failure and iron-deficient anaemia is as follows: Please take the following medications for the next two weeks unless otherwise specified: Bisoprolol 2.5mg once daily orally (GP to review), Alendronic Acid 70mg once daily orally (GP to review), Adcal-D3 two tablets twice daily orally (stop once the course is finished), Omeprazole 40mg once daily orally (GP to review), Glyceryl Trinitrate 400 micrograms (two doses when required via sublingual spray; GP to review), Warfarin Sodium once daily orally at the dose determined by your INR (GP to check INR), Folic Acid 5mg twice daily orally (GP to review; note that this dose was increased to raise your iron level), Ramipril 7.5mg once daily orally (GP to review), Simvastatin 40mg every night orally (GP to review), and Gliclazide m/r 120mg once daily orally (GP to review). For your ongoing care, your GP needs to repeat your Full Blood Count (FBC) every two weeks; please contact Dr. Deep immediately if your Hb falls below 8.00. You have hospital outpatient follow-up appointments scheduled with Dr. Wide in 6 weeks and Dr. Deep in 8 weeks. Outstanding medical requirements include an arranged colonoscopy and a Queen Days Unit appointment. You have also been referred to Occupational Therapy and Physiotherapy, and you will be provided with home oxygen equipment. As you are partially blind, please ensure all pharmacy instructions are printed in a large font for accessibility.
```

## GPT-5.4 mini

- Model: `gpt-5.4-mini`
- Completed: yes
- Total workflow time: 52,690 ms
- Total input tokens: 3,184
- Total output tokens: 9,713
- Total tokens: 12,897
- Estimated cost: $0.04610
- Pricing source: OpenAI official pricing page
- Medication recall: 10/10
- Follow-up recall: 5/6
- JSON valid: yes
- Events generated: 66
- Medication events generated: 66
- Single-medication events: 66
- Grouped-medication events: 0
- Duplicate checklist titles: 56
- Two-week medication course preserved: yes
- Twice-daily medication signal preserved: yes
- Simvastatin nightly signal preserved: yes
- INR monitoring signal preserved: yes
- Missing medications: none
- Missing follow-up items: Repeat FBC every two weeks
- Possible extra medication-like checklist titles: none

### Sample generated checklist events

```text
1. Take bisoprolol - Bisoprolol 2.5 mg, oral, once daily for 2 weeks; take as prescribed and GP to review.
2. Take alendronic acid - Alendronic acid 70 mg, oral, once daily for 2 weeks; take as prescribed and GP to review.
3. Take Adcal-D3 - Adcal-D3 2 tablets, oral, twice daily for 2 weeks; take as prescribed and stop after course is finished.
4. Take Adcal-D3 - Adcal-D3 2 tablets, oral, twice daily for 2 weeks; take as prescribed and stop after course is finished.
5. Take omeprazole - Omeprazole 40 mg, oral, once daily for 2 weeks; take as prescribed and GP to review.
6. Take warfarin - Warfarin sodium, oral, once daily as per INR for 2 weeks; take as prescribed and check INR.
7. Take folic acid - Folic acid 5 mg, oral, twice daily for 2 weeks; take as prescribed and GP to review.
8. Take folic acid - Folic acid 5 mg, oral, twice daily for 2 weeks; take as prescribed and GP to review.
9. Take ramipril - Ramipril 7.5 mg, oral, once daily for 2 weeks; take as prescribed and GP to review.
10. Take simvastatin - Simvastatin 40 mg, oral, every night for 2 weeks; take as prescribed and GP to review.
11. Take gliclazide - Gliclazide m/r 120 mg, oral, once daily for 2 weeks; take as prescribed and GP to review.
12. Use glyceryl trinitrate - Glyceryl trinitrate spray 400 micrograms per dose, sublingual, use when needed for 2 weeks; take 2 doses per use and GP to review.
```

### Care-plan excerpt

```text
You were admitted on 19/01/09 with shortness of breath and chest pain and were found to have pulmonary oedema; your main diagnosis is left ventricular failure and you also have iron-deficiency anaemia, with a melaena episode during admission; tests showed troponin negative, CT colonography was done, OGD showed iron-stained stool only and diverticular disease, and colonoscopy could not be performed because of increased shortness of breath, so this remains outstanding and is to be arranged. You improved on BiPAP, Isoket and frusemide, with no change in the rationale for treatment; MRSA and C. difficile tests were negative and you have no known allergies. Please take bisoprolol 2.5 mg orally once daily for 2 weeks (GP: please review), alendronic acid 70 mg orally once daily for 2 weeks (GP: please review), Adcal-D3 two tablets orally twice daily for 2 weeks (GP: stop after course is finished), omeprazole 40 mg orally once daily for 2 weeks (GP: please review), glyceryl trinitrate spray 400 micrograms per dose, two doses, sublingual when required for 2 weeks (GP: please review), warfarin sodium orally once daily as per INR for 2 weeks (GP: check INR), folic acid 5 mg orally twice daily for 2 weeks (GP: please review) and folic acid should be increased to raise the iron level, ramipril 7.5 mg orally once daily for 2 weeks (GP: please review), simvastatin 40 mg orally every night for 2 weeks (GP: please review), and gliclazide m/r 120 mg orally once daily for 2 weeks (GP: please review). Arrange repeat FBC every 2 weeks and contact Dr Deep if your Hb falls below 8.00; follow-up is planned in 6 weeks with Dr Wide and in 8 weeks with Dr Deep, with Queen Days Unit to be arranged, and you have also been referred to Occupational Therapy and Physiotherapy. Home oxygen has been prov
```

## Gemma 4

- Model: `google/gemma-4-26b-a4b-it-maas`
- Completed: yes
- Total workflow time: 22,352 ms
- Total input tokens: 3,196
- Total output tokens: 4,216
- Total tokens: 7,412
- Estimated cost: $0.00301
- Pricing source: third-party Vertex Gemma listing; confirm with Google Cloud billing
- Medication recall: 10/10
- Follow-up recall: 3/6
- JSON valid: yes
- Events generated: 22
- Medication events generated: 10
- Single-medication events: 10
- Grouped-medication events: 0
- Duplicate checklist titles: 0
- Two-week medication course preserved: yes
- Twice-daily medication signal preserved: yes
- Simvastatin nightly signal preserved: yes
- INR monitoring signal preserved: yes
- Missing medications: none
- Missing follow-up items: Contact Dr Deep if Hb falls below 8.00, 6 week follow-up with Dr Wide, 8 week follow-up with Dr Deep
- Possible extra medication-like checklist titles: none

### Sample generated checklist events

```text
1. Take Bisoprolol - 2.5mg orally, once daily for 14 days
2. Take Alendronic Acid - 70mg orally, once daily for 14 days
3. Take Adcal-D3 - Two tablets orally, twice daily for 14 days
4. Take Omeprazole - 40mg orally, once daily for 14 days
5. Take Glyceryl Trinitrate - 400 micrograms sublingual spray, two doses when required
6. Take Warfarin Sodium - Dose as per INR, once daily orally for 14 days
7. Take Folic Acid - 5mg orally, twice daily for 14 days to raise iron level
8. Take Ramipril - 7.5mg orally, once daily for 14 days
9. Take Simvastatin - 40mg orally, every night for 14 days
10. Take Gliclazide m/r - 120mg orally, once daily for 14 days
11. Monitor Hb Level - Contact Dr. Deep immediately if Hb falls below 8.00
12. Check INR - Required for Warfarin management
```

### Care-plan excerpt

```text
Your care plan following your admission for left ventricular failure, pulmonary oedema, and iron-deficient anaemia (with diverticular disease noted via OGD) involves several important steps. Please take the following medications for the next two weeks unless otherwise specified: Bisoprolol 2.5mg once daily orally, Alendronic Acid 70mg once daily orally, Adcal-D3 two tablets twice daily orally (stop once the course is finished), Omeprazole 40mg once daily orally, Glyceryl Trinitrate 400 micrograms (two doses when required via sublingual spray), Warfarin Sodium once daily orally (dose as per INR), Folic Acid 5mg twice daily orally (dose increased to raise iron level), Ramipril 7.5mg once daily orally, Simvastatin 40mg every night orally, and Gliclazide m/r 120mg once daily orally. Your GP needs to review most of these medications, specifically check your INR for Warfarin, and repeat your Full Blood Count (FBC) every two weeks; please contact Dr. Deep immediately if your Hb falls below 8.00. For your ongoing care, you will have hospital outpatient follow-ups with Dr. Wide in 6 weeks and Dr. Deep in 8 weeks, and arrangements will be made for a colonoscopy and the Queen Days Unit. Referrals have been made to Occupational Therapy and Physiotherapy, and you will be provided with home oxygen equipment. Due to your visual impairment, please ensure your pharmacy prints all medication instructions in a large font.
```

## GPT-5.4 mini

- Model: `gpt-5.4-mini`
- Completed: yes
- Total workflow time: 44,070 ms
- Total input tokens: 3,616
- Total output tokens: 7,941
- Total tokens: 11,557
- Estimated cost: $0.03845
- Pricing source: OpenAI official pricing page
- Medication recall: 10/10
- Follow-up recall: 6/6
- JSON valid: yes
- Events generated: 50
- Medication events generated: 43
- Single-medication events: 43
- Grouped-medication events: 0
- Duplicate checklist titles: 33
- Two-week medication course preserved: yes
- Twice-daily medication signal preserved: yes
- Simvastatin nightly signal preserved: yes
- INR monitoring signal preserved: yes
- Missing medications: none
- Missing follow-up items: none
- Possible extra medication-like checklist titles: none

### Sample generated checklist events

```text
1. Take Glyceryl Trinitrate - 400 micrograms; sublingual; when required; for 2 weeks; use for chest pain as directed and GP to review.
2. Take Warfarin - Dose as per INR; oral; once daily; for 2 weeks; take exactly as prescribed and GP to check INR.
3. Take Alendronic Acid - 70 mg; oral; once daily; for 2 weeks; take as directed and GP to review.
4. Take Simvastatin - 40 mg; oral; every night; for 2 weeks; take at bedtime and GP to review.
5. Take Bisoprolol - 2.5 mg; oral; once daily; for 2 weeks; take as prescribed and GP to review.
6. Take Gliclazide - 120 mg MR; oral; once daily; for 2 weeks; take with food and GP to review.
7. Take Omeprazole - 40 mg; oral; once daily; for 2 weeks; take before food and GP to review.
8. Take Ramipril - 7.5 mg; oral; once daily; for 2 weeks; take as prescribed and GP to review.
9. Take Adcal-D3 - 2 tablets; oral; twice daily; for 2 weeks; take with food and stop after the course is finished.
10. Take Folic acid - Dose as prescribed; oral; once daily; ongoing; increase the dose to raise iron level as directed.
11. Use Home oxygen - As prescribed; via home oxygen; ongoing; use exactly as instructed and keep equipment safe.
12. Arrange Colonoscopy - Referral/appointment; outpatient; once; arrange the outstanding colonoscopy investigation as the inpatient attempt was not completed due to breathlessness.
```

### Care-plan excerpt

```text
You were admitted on **19/01/09** with **dyspnoea and chest pain** and were found to have **pulmonary oedema** and **left ventricular failure**; you also had an episode of **melaena** during admission and have **iron-deficient anaemia**. Tests showed **troponin negative**; **CT colonography** was performed; **OGD** showed **iron stained stool only** and **diverticular disease**; **colonoscopy could not be performed because of increased shortness of breath**, so an **outstanding hospital investigation is for colonoscopy to be arranged**. You improved with **Bipap, Isoket, and Frusemide**. Please take your discharge medicines as follows: **Glyceryl Trinitrate 400 micrograms per dose sublingual when required for 2 weeks (GP: please review; medication on ward)**; **Warfarin Sodium as per INR orally once daily for two weeks (GP: check INR; medication on ward)**; **Alendronic Acid 70 mg orally once daily for 2 weeks (GP: please review; pharmacy to dispense)**; **Simvastatin 40 mg orally every night for two weeks (GP: please review; medication on ward)**; **Bisoprolol 2.5 mg orally once daily for 2 weeks (GP: please review; pharmacy to dispense)**; **Gliclazide m/r 120 mg orally once daily for two weeks (GP: please review; medication on ward)**; **Omeprazole 40 mg orally once daily for 2 weeks (GP: please review; at home)**; **Ramipril 7.5 mg orally once daily for two weeks (GP: please review; pre-pack from ward)**; **Adcal-D3 two tablets orally twice daily for 2 weeks, then stop after the course is finished (medication on ward)**; and **folic acid is to be increased to raise the iron level**. Your GP should also **repeat FBC every two weeks** and **contact Dr Deep if the Hb falls below 8.00**; **check INR** for warfarin, and the plan includes **Queen Days Unit to be arranged*
```

## Gemma 4

- Model: `google/gemma-4-26b-a4b-it-maas`
- Completed: yes
- Total workflow time: 21,483 ms
- Total input tokens: 3,223
- Total output tokens: 4,009
- Total tokens: 7,232
- Estimated cost: $0.00289
- Pricing source: third-party Vertex Gemma listing; confirm with Google Cloud billing
- Medication recall: 10/10
- Follow-up recall: 3/6
- JSON valid: yes
- Events generated: 20
- Medication events generated: 10
- Single-medication events: 10
- Grouped-medication events: 0
- Duplicate checklist titles: 0
- Two-week medication course preserved: yes
- Twice-daily medication signal preserved: yes
- Simvastatin nightly signal preserved: yes
- INR monitoring signal preserved: yes
- Missing medications: none
- Missing follow-up items: Contact Dr Deep if Hb falls below 8.00, 6 week follow-up with Dr Wide, 8 week follow-up with Dr Deep
- Possible extra medication-like checklist titles: none

### Sample generated checklist events

```text
1. Take Bisoprolol - 2.5mg orally, once daily for 14 days. GP to review.
2. Take Alendronic Acid - 70mg orally, once daily for 14 days. GP to review.
3. Take Adcal-D3 - Two tablets orally, twice daily for 14 days. Stop once course is finished.
4. Take Omeprazole - 40mg orally, once daily for 14 days. GP to review.
5. Use Glyceryl Trinitrate - 400 micrograms sublingual spray, two doses when required. GP to review.
6. Take Warfarin Sodium - As per INR, once daily for 14 days. GP to check INR.
7. Take Folic Acid - 5mg orally, twice daily for 14 days. GP to review; dose increased to raise iron levels.
8. Take Ramipril - 7.5mg orally, once daily for 14 days. GP to review.
9. Take Simvastatin - 40mg orally, every night for 14 days. GP to review.
10. Take Gliclazide m/r - 120mg orally, once daily for 14 days. GP to review.
11. Monitor Hb Levels - Contact Dr. Deep immediately if Hb falls below 8.00.
12. Repeat FBC Test - Full Blood Count (FBC) every two weeks.
```

### Care-plan excerpt

```text
Your care plan following your admission for left ventricular failure, pulmonary oedema, and iron-deficient anaemia (with diverticular disease noted via OGD) involves several important steps for your recovery. Please take the following medications as prescribed for the next two weeks unless otherwise noted: Bisoprolol 2.5mg once daily orally (GP to review), Alendronic Acid 70mg once daily orally (GP to review), Adcal-D3 two tablets twice daily orally (stop once the course is finished), Omeprazole 40mg once daily orally (GP to review), Glyceryl Trinitrate 400 micrograms two doses when required via sublingual spray (GP to review), Warfarin Sodium as per your INR once daily orally (GP to check INR), Folic Acid 5mg twice daily orally (GP to review; dose increased to raise iron levels), Ramipril 7.5mg once daily orally (GP to review), Simvastatin 40mg every night orally (GP to review), and Gliclazide m/r 120mg once daily orally (GP to review). For your ongoing monitoring, your GP needs to repeat your Full Blood Count (FBC) every two weeks; please contact Dr. Deep immediately if your Hb falls below 8.00. Regarding follow-up, you have outpatient appointments scheduled in 6 weeks with Dr. Wide and 8 weeks with Dr. Deep. Outstanding investigations include a colonoscopy and an appointment with the Queen Days Unit. You will also receive referrals to Occupational Therapy and Physiotherapy, and you have been provided with home oxygen equipment. Due to your visual impairment, please ensure your pharmacy prints all medication instructions in a large font.
```

## GPT-5.4 mini

- Model: `gpt-5.4-mini`
- Completed: yes
- Total workflow time: 48,409 ms
- Total input tokens: 3,266
- Total output tokens: 9,676
- Total tokens: 12,942
- Estimated cost: $0.04599
- Pricing source: OpenAI official pricing page
- Medication recall: 10/10
- Follow-up recall: 4/6
- JSON valid: yes
- Events generated: 52
- Medication events generated: 46
- Single-medication events: 46
- Grouped-medication events: 0
- Duplicate checklist titles: 36
- Two-week medication course preserved: yes
- Twice-daily medication signal preserved: yes
- Simvastatin nightly signal preserved: yes
- INR monitoring signal preserved: yes
- Missing medications: none
- Missing follow-up items: Repeat FBC every two weeks, Contact Dr Deep if Hb falls below 8.00
- Possible extra medication-like checklist titles: none

### Sample generated checklist events

```text
1. Use GTN - Glyceryl Trinitrate 400 micrograms per dose, spray, 2 doses, sublingual, when required for 2 weeks; use for chest pain and review if needed.
2. Take Warfarin - Warfarin Sodium as per INR, orally once daily for 2 weeks; take exactly as directed and check INR.
3. Take Alendronic Acid - Alendronic Acid 70 mg, orally once daily for 2 weeks; take as prescribed and please review.
4. Take Simvastatin - Simvastatin 40 mg, orally every night for 2 weeks; take at bedtime and please review.
5. Take Bisoprolol - Bisoprolol 2.5 mg, orally once daily for 2 weeks; take as prescribed and please review.
6. Take Gliclazide - Gliclazide m/r 120 mg, orally once daily for 2 weeks; take as prescribed and please review.
7. Take Omeprazole - Omeprazole 40 mg, orally once daily for 2 weeks; take as prescribed and please review.
8. Take Folic acid - Folic acid 5 mg, orally twice daily for 2 weeks; take morning and evening to help raise the iron level.
9. Take Ramipril - Ramipril 7.5 mg, orally once daily for 2 weeks; take as prescribed and please review.
10. Take Adcal-D3 - Adcal-D3 two tablets, orally twice daily for 2 weeks; take morning and evening and stop after the course is finished.
11. Review large font instructions - Print all instructions in large font because you are partially blind; general care action for ongoing use.
12. Use home oxygen - Home oxygen provided; use as directed and follow the prescribed oxygen plan.
```

### Care-plan excerpt

```text
You were admitted on 19/01/09 with dyspnoea and chest pain and were found to be in pulmonary oedema; during admission you also had an episode of melaena, and the admission diagnoses were left ventricular failure and iron-deficient anaemia. You improved after treatment with Bipap, Isoket and Frusemide, and there was no change stated as the reason for significant changes in treatment. Tests and procedures showed troponin was negative; CT colonography was performed; OGD showed iron stained stool only and diverticular disease; colonoscopy could not be performed because of increased shortness of breath, and a colonoscopy still needs to be arranged as an outstanding hospital investigation. Please follow up with Dr Wide in 6 weeks and Dr Deep in 8 weeks, and Queen Days Unit is to be arranged for planned inpatient follow-up/procedures. Your GP should repeat a full blood count every 2 weeks, check the INR for warfarin, increase folic acid to raise the iron level, and contact Dr Deep if haemoglobin falls below 8.00. You have also been referred to Occupational Therapy and Physiotherapy, home oxygen has been provided, and the community team has seen you and your family. You are MRSA negative, C. difficile negative, and have no known allergies. Please print all instructions in large font as you are partially blind. Your discharge medicines are: Glyceryl Trinitrate 400 micrograms per dose, spray, 2 doses, sublingual, when required for 2 weeks, please review; Warfarin Sodium as per INR, orally once daily for 2 weeks, check INR; Alendronic Acid 70 mg orally once daily for 2 weeks, please review; Simvastatin 40 mg orally every night for 2 weeks, please review; Bisoprolol 2.5 mg orally once daily for 2 weeks, please review; Gliclazide m/r 120 mg orally once daily for 2 weeks, please revi
```
