# Surveys

Surveys let you ask visitors questions in a popup, a slide in, or through a standalone shareable link. Every answer saves to a named contact variable that BotMaps flows can use for personalization and follow up.

## Build a survey

1. Open Growth Suite and click the Surveys tab.
2. Click New Survey.
3. Add questions. You can use multiple choice, checkboxes, star or number rating, NPS 0 to 10, short text, long text, date, and dropdown.
4. Drag questions to reorder them. You can also use the up and down arrows.
5. Give each question a label and mark it required where it matters.
6. Name a contact variable for each answer. This is where the answer is stored on the contact.
7. Click Save, then set the survey to Active when you are ready to collect answers.

## Contact variables

Each answer saves to the contact variable you name, and you can reference it anywhere in BotMaps with `{{variable_name}}`.

- Variable names must be lowercase letters, numbers, and underscores, starting with a letter.
- Some names are reserved for the system (such as `first_name`, `last_name`, `email`, and `phone`). The builder blocks those with a clear message.
- Two questions in the same survey cannot use the same variable name.
- Checkbox answers save as comma separated text on the contact.

## Share a survey

Every active survey gets a standalone link in the builder. Copy it and share it anywhere: email, SMS, social posts, or a QR code.

### Popup or slide in

1. Open Growth Suite and click Website Overlays.
2. Create or edit an overlay.
3. Set the CTA action to Take Survey and pick your survey.
4. Publish the overlay. Visitors see the survey right inside the popup or slide in, and completions are tracked like any other overlay event.

## Use answers in BotMaps

Two ways to connect surveys to BotMaps:

- **Send survey action.** Add it to any node in the Flow Builder. When the flow reaches that node, the contact gets the survey link. Their answers land in the survey's contact variables.
- **Survey completed trigger.** Add this entry point to a flow and pick the survey. When a visitor finishes that survey, the flow starts with their answers already saved to the contact.

## Results

Open the survey and click Results to see:

- Response counts and percentages per option for multiple choice, checkboxes, and dropdown.
- Average scores for rating and NPS questions.
- Recent text answers for short text, long text, and date questions.
- A list of recent responses with contact details.

Closing a survey stops new responses but keeps all results. Reopening sets it back to Active.
