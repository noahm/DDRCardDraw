# DDR Tools Network Features (Discontinued)

The peer-to-peer network features that let DDR Tools send and sync drawn cards between devices have been removed from the app.

They were inherently unreliable: a device losing connection also lost its hostname reservation, reconnecting had to be done one peer at a time, and messages between devices were sometimes silently dropped. Rather than keep patching that design, networking has been rebuilt from scratch in the alpha build.

## Use the alpha build instead

If you run tournaments, share draws with commentary or spectator devices, or drive card draw on a live stream, use the alpha build instead:

**<https://next.ddr.tools/>**

Its networking is far more robust than the features described here ever were. Bear in mind that it is an alpha build, so expect some rough edges and [please reach out](readme.md#contact) with any issues you run into.
