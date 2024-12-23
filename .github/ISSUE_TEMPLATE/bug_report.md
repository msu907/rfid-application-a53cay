---
name: Bug Report
about: Create a report to help us improve the RFID Asset Tracking System
title: '[BUG] '
labels: bug, triage
assignees: ''
---

## Bug Description
<!-- Provide a clear and concise description of the bug -->

### Summary
<!-- Required: Describe what the bug is -->

### Error Code
<!-- Required: Select the appropriate error code -->
<!-- Must match pattern: (RDR|DB|API|SYS|SEC)-\d{3} -->
Select one:
- [ ] RDR-001 (Reader Connection Lost)
- [ ] RDR-002 (Invalid Tag Format)
- [ ] DB-001 (Database Connection Error)
- [ ] API-001 (Rate Limit Exceeded)
- [ ] SYS-001 (System Resource Exhaustion)
- [ ] SEC-001 (Authentication Failure)

### Business Impact
<!-- Required: Select the impact level -->
Select one:
- [ ] Critical
- [ ] High
- [ ] Medium
- [ ] Low

## Environment
<!-- Required: Provide details about where the bug occurred -->

### Affected Component
<!-- Required: Select the affected system component -->
Select one:
- [ ] Web Application
- [ ] API Gateway
- [ ] Asset Service
- [ ] Reader Service
- [ ] Visualization Service

### Environment Type
<!-- Required: Select the environment where the bug occurred -->
Select one:
- [ ] Development
- [ ] Staging
- [ ] Production

### Version
<!-- Required: Provide the version number (format: x.y.z) -->
Version: 

## Monitoring Data
<!-- Optional: Include any relevant monitoring data -->

### Performance Metrics
<details>
<summary>Metrics Data</summary>

```json
// Insert metrics JSON data here
```
</details>

### System Traces
<details>
<summary>Trace Logs</summary>

```
// Insert relevant system traces here
```
</details>

## Steps to Reproduce
1. 
2. 
3. 

## Expected Behavior
<!-- Describe what you expected to happen -->

## Actual Behavior
<!-- Describe what actually happened -->

## Screenshots
<!-- If applicable, add screenshots to help explain the problem -->

## Additional Context
<!-- Add any other context about the problem here -->

<!-- 
Note: This issue will be automatically assigned based on the affected component:
- Web Application issues -> @frontend-team
- API Gateway issues -> @backend-team
- Reader Service issues -> @rfid-team
-->