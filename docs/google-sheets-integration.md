# Google Sheets connection

## What it does

The Google Sheets connection links one of your spreadsheets to your ChatMize
workspace. Once it is connected, two things become possible:

1. **Log answers to a sheet.** Every answer a BotMap flow captures (a name, an
   email, a phone number, any variable you save) can be written as a new row in
   your sheet, automatically. Perfect for lead lists, bookings, and survey
   results you want in one place.
2. **Read from a sheet.** Flows can look up rows in your sheet and use them to
   personalize replies. Keep a price list, an event schedule, or a product list
   in a tab and let the bot pull the right row before it answers. API users get
   the same power through the sheets_append_row, sheets_read_rows, and
   sheets_list_tabs tools.

## Privacy

ChatMize only asks Google for access to your spreadsheets. It can read and
write rows in your sheets. It cannot see your Drive files, your email, or
anything else. Your Google token is encrypted on our servers and is never
shown in the app. You can disconnect at any time, which deletes the token.

## Connect in three steps

### Step 1: Connect with Google

1. Open **Settings**, then the **Integrations** tab.
2. Find **Google Sheets** (look in Automation, or use search) and open it.
3. Click **Connect with Google**.
4. Google asks you to pick an account and approve spreadsheet access. Approve
   it. You come straight back to ChatMize.

You will see "Connected as your@email.com". That is the account ChatMize uses
for every sheet read and write.

### Step 2: Pick your spreadsheet

1. In the same Google Sheets card, paste your sheet link (or just the sheet
   id) into the **Spreadsheet** field and press **Save**.
2. ChatMize opens the sheet to confirm it can read it, then shows the title.
3. Put your **column names in row 1** of the tab you want to use. For example:
   Name, Email, Phone. These headers are what the column mapping uses.

Tip: if ChatMize says it cannot open the sheet, make sure you pasted the full
link and that the connected Google account can open the sheet.

### Step 3: Map columns in BotMaps

1. Open a flow in **BotMaps** and add an **action** step.
2. In the step editor, find **Log to Google Sheet**.
3. Type the **tab name** (the tab at the bottom of your sheet, for example
   Leads).
4. Click **Map a column** for each value you want to log. On the left put the
   **column header** exactly as it appears in row 1. On the right put the
   **variable name** holding the captured answer (for example email).
5. Connect the step into your flow and publish.

From then on, every time someone reaches that step, a new row appears at the
bottom of your sheet with their answers under the right columns.

## Reading from a sheet

To personalize a reply from sheet data, use the API tools or a custom step:

- **sheets_list_tabs** shows every tab and its column headers.
- **sheets_read_rows** reads rows from a tab. Pass a tab name, and optionally a
  column plus a value to match (for example match the Email column to the
  contact's email) to get just the rows you need.
- **sheets_append_row** adds a row from code or from another system.

## Troubleshooting

- **"Google revoked access."** Open the Google Sheets card and click Connect
  with Google again. Google grants expire if the account password changes or
  access is removed.
- **"That spreadsheet or tab was not found."** Check the link, the tab name
  spelling, and that the sheet still exists.
- **"Google says no."** The connected Google account needs at least viewer
  access to read and editor access to write. Share the sheet with that account.
- **A row lands in the wrong columns.** The mapping matches the header text in
  row 1 exactly, including spaces and capitalization. Fix the header or the
  mapping so they match.
- **The tab has no header row.** Add your column names to row 1 first. ChatMize
  will not guess where your data starts.
