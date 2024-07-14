import { EventEntrantsDocument } from "./generated/graphql";
import { Client, cacheExchange, fetchExchange } from "@urql/core";

const client = new Client({
  url: "https://api.start.gg/gql/alpha",
  fetchOptions: {
    headers: {
      Authorization: `Bearer ${process.env.STARTGG_TOKEN}`,
    },
  },
  exchanges: [cacheExchange, fetchExchange],
});

export function getEventEntrants(slug: string) {
  return client.query(EventEntrantsDocument, { eventSlug: slug });
}
