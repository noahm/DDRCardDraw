import "dotenv/config";

export default {
  schema: [
    {
      "https://api.start.gg/gql/alpha": {
        headers: {
          Authorization: `Bearer ${process.env.STARTGG_TOKEN}`,
        },
      },
    },
  ],
  documents: ["./src/startgg-gql/queries.ts"],
};
