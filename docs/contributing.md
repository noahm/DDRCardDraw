# Contribution Guide

## Guided Tour

Here's a step-by-step guide to a simple, yet significant addition to the app: adding new data to songs/charts and a new option in settings to filter based upon that data.

All along the way you can have `yarn validate:ts --watch` running in a background terminal. Anytime you save a file it lists out type errors found anywhere in the project. Try to take a look whenever they come up, because it's almost always meaningful, even if the error text itself might be hard to interpret.

### Step One - Update Schema

The [songs.schema.json](../songs.schema.json) file describes the shape of what a valid data file is. If you plan to add new fields to songs or charts in the data, then you should update the schema first. The file is using the [JSON Schema](https://json-schema.org/learn/getting-started-step-by-step.html) format to describe possible properties, and which ones are required.

After updating the schema, run `yarn validate:json` which will do two things:

- check existing data files against your new schema and report any errors
- updates the generated type definitions in [SongData.ts](../src/models/SongData.ts) so that you get matching typescript info about the data within the app business logic

### Step Two - Update Controls State

The backing store which defines the state for every setting in the app is in [config-state.tsx](../src/config-state.tsx) and you need to update the `ConfigState` interface found at the top of the file to describe the backing state for the additional settings you're adding.

Once you make changes there, you should see errors a few lines lower in the file indicating you also need to update the _initial state_ to match your changes.

If you're adding additional keys of the `ReadonlySet` type like the existing `difficulties` or `flags` properties, you'll also have to update [config-persistence.ts](../src/config-persistence.ts) to convert your new setting between an Array and a Set instance when saving or loading settings.

Then, in no particular order, you can finish the remaining steps:

### Update Card Draw Logic

Update business logic in [card-draw.ts](../src/card-draw.ts) to adjust the actual card draw behavior based on the combination of the new settings, and the new info in the data file.

### Update Settings UI

Make changes in the settings UI, probably in [controls/index.tsx](../src/controls/index.tsx) or another neighboring file. The UI code for the controls isn't all that well organized, so please accept my apologies.

You'll have to mimick the existing patterns to both read from and display the existing state through new controls, and also update the underlying config state in response to user interactions.

For more information how to use the various form controls available in Blueprint, the UI/design library used by ddr.tools, [consult their documentation site](https://blueprintjs.com/docs/#core).

### Add new info to the data file

Update the JSON data file for your game in question inside of [src/songs](../src/songs/) to include new data that conforms to your changes made in the schema file in step one. Be sure to re-run `yarn validate:json` to double check your changes.

### Optional: Update card UI to display new data

If the info you're adding is also something that should display _on the cards_, you have a bit more work in store.

First, update the `EligibleChart` interface in [Drawing.ts](../src/models/Drawing.ts) to include the info needed to display. That will create type errors in [card-draw.ts](../src/card-draw.ts) for you to fix where each chart's data is copied from the data file into new `EligibleChart` objects as part of the draw business logic.

Finally, you'll be able to make changes in [song-card.tsx](../src/song-card/song-card.tsx) (or one of its sibling files) where the `EligibleChart` and `DrawnChart` objects are passed in as a prop to be rendered as a card.
