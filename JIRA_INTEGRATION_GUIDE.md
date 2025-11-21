# Jira Integration Guide - Project Import

## Overview
This guide explains how to connect your Weekly Leadership Report Tool to Jira to automatically import project data from Jira epics.

## What Gets Imported

When you import from Jira, the system automatically:
- **Imports Projects** from Jira epics
- **Extracts Team Leads** from epic assignees/reporters
- **Finds Team Members** from all issue assignees under each epic
- **Sets Project Dates** from epic creation and due dates
- **Maps Customer Info** from epic descriptions or project names

All people (leads and team members) are automatically added to your system if they don't already exist.

---

## Quick Setup (5 Minutes)

### Step 1: Get Your Jira Credentials

1. **Jira URL**: Your Atlassian domain (e.g., `https://your-company.atlassian.net`)
2. **Email**: Your Jira account email
3. **API Token**: 
   - Go to https://id.atlassian.com/manage-profile/security/api-tokens
   - Click "Create API token"
   - Give it a name (e.g., "Weekly Reports Tool")
   - Copy the token (you'll only see it once!)

### Step 2: Add Credentials to Replit

1. In your Replit project, click **Tools → Secrets**
2. Add these three secrets:

```
JIRA_URL=https://your-company.atlassian.net
JIRA_EMAIL=your-email@example.com
JIRA_API_TOKEN=your_api_token_here
```

**Important**: 
- Don't include trailing slashes in the URL
- Use the full URL including `https://`
- Keep your API token secure

### Step 3: Test the Connection

1. Go to the **Dashboard** tab in your application
2. Click **"Import from Jira"**
3. Enter your Jira project key (e.g., "PROJ") or leave empty for all projects
4. Click **Import**

That's it! Your projects should now appear in the dashboard.

---

## How It Works

### Data Mapping

| Jira Field | Maps To | Notes |
|------------|---------|-------|
| Epic Summary | Project Name | The epic's title becomes the project name |
| Epic Assignee | Project Lead | Epic assignee is set as the project lead |
| Epic Reporter | Fallback Lead | If no assignee, reporter becomes lead |
| Issue Assignees | Team Members | All assignees from issues under the epic |
| Epic Created Date | Start Date | When the epic was created |
| Epic Due Date | End Date | Epic's due date (or +90 days if not set) |
| Epic Description | Customer | Searches for "Customer: XYZ" in description |
| Project Name | Customer Fallback | Uses project name if no customer found |

### Team Member Detection

The system collects team members from:
1. Epic assignee
2. Epic reporter
3. All issue assignees under the epic
4. All issue reporters under the epic

Duplicates are automatically removed, and the epic assignee becomes the project lead.

---

## Usage Examples

### Import All Epics
Leave the project key field empty to import all epics from all Jira projects.

### Import From Specific Project
Enter a project key (e.g., "MOBILE") to only import epics from that project.

### Re-Import Updates
Running import again will:
- Skip duplicate people (based on Jira account ID)
- Add new projects from newly created epics
- Keep existing projects unchanged

---

## Troubleshooting

### "Jira credentials not configured"
**Solution**: Make sure all three secrets (JIRA_URL, JIRA_EMAIL, JIRA_API_TOKEN) are set in Replit Secrets.

### "Failed to import from Jira"
**Possible causes**:
1. **Wrong API token**: Generate a new one and update the secret
2. **Wrong email**: Must match your Jira account email
3. **Wrong URL**: Should be `https://your-domain.atlassian.net` (no trailing slash)
4. **Permissions**: Your Jira account must have permission to view the projects

### No projects imported
**Possible causes**:
1. **No epics in Jira**: Create some epics first
2. **Wrong project key**: Double-check the key in Jira
3. **Epics have no assignee/reporter**: Epics must have at least one assigned person

### Some team members missing
**Note**: Only people assigned to issues or epics are imported. Watchers and commenters are not included.

---

## Advanced Configuration

### Custom Field Mapping

If your Jira instance uses custom fields for customer information, you can modify `server/services/jiraService.ts`:

```typescript
private extractCustomer(epic: JiraIssue, projectKey?: string): string {
  // Check for custom field (replace with your field ID)
  const customerId = 'customfield_10100'; // Your customer field ID
  if (epic.fields[customerId]) {
    return epic.fields[customerId];
  }
  
  // Fallback to description parsing
  if (epic.fields.description) {
    const customerMatch = epic.fields.description.match(/customer[:\s]+([^\n]+)/i);
    if (customerMatch) {
      return customerMatch[1].trim();
    }
  }

  return `${projectKey || 'Unknown'} Project`;
}
```

### Finding Custom Field IDs

1. Go to Jira → Settings → Issues → Custom Fields
2. Find your field and click the gear icon
3. The URL will show the field ID (e.g., `customfield_10100`)

---

## Data Privacy & Security

### What's Stored
- Jira account IDs (hashed identifiers)
- Display names from Jira
- Epic keys and summaries
- Dates and descriptions

### What's NOT Stored
- Your API token (only stored in Replit Secrets)
- Issue details or comments
- Attachments or sensitive data
- Historical changes or audit logs

### Security Best Practices
1. Never share your API token
2. Use Replit Secrets (not environment variables)
3. Rotate API tokens periodically
4. Review imported data before sharing reports

---

## API Details

### Jira APIs Used

**Search API** (`/rest/api/3/search`):
- Searches for epics using JQL: `issuetype = Epic`
- Searches for issues under epics: `parent = EPIC-123`

**Fields Retrieved**:
- `key, summary, assignee, reporter, created, updated, duedate, status, description`

### Rate Limits
- Jira Cloud: ~1000 requests per hour per user
- The import uses ~2 API calls per epic (1 for epic, 1 for issues)
- Importing 100 epics = ~200 API calls

---

## Example Workflow

1. **Create Epics in Jira**:
   - Create an epic: "Mobile App Redesign"
   - Assign it to the project lead
   - Set due date
   - Add "Customer: Acme Corp" in description

2. **Create Issues Under Epic**:
   - Create stories/tasks
   - Assign to team members
   - Link them to the epic

3. **Import to Report Tool**:
   - Click "Import from Jira"
   - Enter project key or leave empty
   - Review imported project in Dashboard

4. **Use for Weekly Reports**:
   - Project appears in report submission
   - Team lead creates weekly status updates
   - Team members are tracked automatically

---

## Benefits

✅ **Automatic Sync** - Keep your project list up-to-date with Jira  
✅ **No Manual Entry** - People and projects import automatically  
✅ **Single Source of Truth** - Jira remains your project management hub  
✅ **Consistent Data** - Names and dates match Jira exactly  
✅ **Easy Setup** - Just 3 secrets and you're ready to go

---

## Support & Updates

For issues or questions:
1. Check the troubleshooting section above
2. Verify your Jira credentials in Replit Secrets
3. Check browser console for detailed error messages
4. Review Jira permissions for your account

The integration uses Jira Cloud REST API v3. For API documentation, visit:
- https://developer.atlassian.com/cloud/jira/platform/rest/v3/
