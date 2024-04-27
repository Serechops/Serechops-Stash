const { GraphQLClient, gql } = require('graphql-request');

const endpoint = 'http://localhost:9999/graphql';
const graphQLClient = new GraphQLClient(endpoint);

const findPerformersQuery = gql`
    query FindPerformers {
        findPerformers(
            performer_filter: { scene_count: { value: 0, modifier: GREATER_THAN } }
            filter: { per_page: -1 }
        ) {
            performers {
                id
                name
            }
        }
    }
`;

const findGalleriesQuery = gql`
    query FindGalleries($performerName: String!) {
        findGalleries(
            gallery_filter: { is_zip: true }
            filter: { q: $performerName, per_page: -1 }
        ) {
            galleries {
                id
            }
        }
    }
`;

const galleryUpdateMutation = gql`
    mutation GalleryUpdate($galleryId: ID!, $performerIds: [ID!]!) {
        galleryUpdate(input: { id: $galleryId, performer_ids: $performerIds }) {
            id
        }
    }
`;

async function linkGalleriesToPerformers() {
    // Find performers with scene counts greater than 0
    const { findPerformers } = await graphQLClient.request(findPerformersQuery);
    for (const performer of findPerformers.performers) {
        // Find galleries matching performer names
        const { findGalleries } = await graphQLClient.request(findGalleriesQuery, {
            performerName: performer.name,
        });
        for (const gallery of findGalleries.galleries) {
            // Update galleries to link with the performer
            await graphQLClient.request(galleryUpdateMutation, {
                galleryId: gallery.id,
                performerIds: [performer.id],
            });
            console.log(`Gallery ${gallery.id} linked to performer ${performer.name}`);
        }
    }
}

linkGalleriesToPerformers().catch((error) => console.error(error));
