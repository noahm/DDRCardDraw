import { gql } from "@urql/core";

gql`
  query EventEntrants($eventSlug: String) {
    event(slug: $eventSlug) {
      id
      name
    }
  }
`;
