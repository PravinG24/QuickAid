# QuickAid Troubleshooting Summary by Phase

Source: QuickAid_ProjectManagement.xlsx (Project Management Plan)

## ONE Research
- Issue: External teammates could not be added directly to the university Azure tenant due to directory restrictions.
- Fix: Invited teammates as Guest Users through Microsoft Entra ID.
- Outcome: Cross-organization collaboration and account access worked for the project team.

## TWO Design
- No major troubleshooting issue was explicitly logged for this phase in the spreadsheet.
- Focus in this phase was architecture and workflow design decisions.

## THREE Develop
- Issue: Azure Functions local start (func start) appeared to hang during initial setup.
- Fix: Waited for full runtime initialization and completed all required local.settings.json values.
- Outcome: Backend started correctly in local development.

- Issue: GitHub Actions pipeline ran too early and failed before Azure deployment secrets/settings were ready.
- Fix: Switched workflow trigger to workflow_dispatch until secrets/configuration were finalized.
- Outcome: CI/CD runs became controllable and failed less during setup.

## FOUR Test
- Testing risk identified: hidden runtime or integration errors during unit/integration/end-to-end testing.
- Troubleshooting approach: run test passes and inspect Azure Function logs to catch and fix errors early.
- Outcome: Structured error-checking process used to reduce late-stage defects.

## FIVE Deploy
- No major troubleshooting issue was explicitly logged for this phase in the spreadsheet.
- Deployment preparation emphasized environment readiness and configuration checks.

## SIX Present
- No major troubleshooting issue was explicitly logged for this phase in the spreadsheet.
- Emphasis was on preparing stable demos and communicating outcomes clearly.

## SEVEN Demo
- No major troubleshooting issue was explicitly logged for this phase in the spreadsheet.
- Demo planning focused on showcasing validated end-to-end functionality.

## Reflection Note (From Spreadsheet)
- Team strength observed: confidence in troubleshooting unfamiliar tools and errors independently.
- Improvement area observed: avoid rushing documentation while resolving issues.
