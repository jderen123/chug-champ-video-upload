/**
 * Leaderboard endpoints for fetching and displaying entries
 */

/**
 * GET /leaderboard/:leaderboard_type
 * Fetches all verified entries for a specific leaderboard type
 * Returns entries sorted by time_s (fastest first)
 */
function getLeaderboardEntries(getShopifyAccessToken, shopifyStoreDomain) {
  return async (req, res) => {
    try {
      const { leaderboard_type } = req.params;

      if (!leaderboard_type) {
        return res.status(400).json({ error: 'leaderboard_type is required' });
      }

      const token = await getShopifyAccessToken();

      // GraphQL query to fetch all beer_leaderboard_entry metaobjects
      const query = `
        query GetLeaderboardEntries($type: String!, $first: Int!) {
          metaobjects(type: $type, first: $first) {
            edges {
              node {
                id
                handle
                fields {
                  key
                  value
                }
              }
            }
            pageInfo {
              hasNextPage
              endCursor
            }
          }
        }
      `;

      const variables = {
        type: 'beer_leaderboard_entry',
        first: 250 // Fetch up to 250 entries (Shopify max per page)
      };

      const response = await fetch(
        `https://${shopifyStoreDomain}/admin/api/2024-01/graphql.json`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': token
          },
          body: JSON.stringify({ query, variables })
        }
      );

      const data = await response.json();

      if (data.errors) {
        return res.status(500).json({
          error: 'Failed to fetch entries',
          details: data.errors
        });
      }

      // Transform the Shopify response into a usable format
      const entries = data.data.metaobjects.edges.map(edge => {
        const fields = {};
        edge.node.fields.forEach(field => {
          fields[field.key] = field.value;
        });

        return {
          id: edge.node.id,
          handle: edge.node.handle,
          ...fields
        };
      });

      // Debug logging
      console.log('Total entries fetched:', entries.length);
      console.log('Looking for leaderboard_type:', leaderboard_type);
      console.log('Sample entry:', entries[0]);

      // Filter by leaderboard_type and only include verified entries
      const filteredEntries = entries.filter(entry => {
        const matches = entry.leaderboard_type === leaderboard_type &&
          entry.verified === 'true';
        if (!matches && entry.leaderboard_type === leaderboard_type) {
          console.log('Entry filtered out:', {
            leaderboard_type: entry.leaderboard_type,
            verified: entry.verified,
            verified_type: typeof entry.verified
          });
        }
        return matches;
      });

      // Sort by time_s (fastest times first)
      filteredEntries.sort((a, b) => {
        const timeA = parseFloat(a.time_s) || Infinity;
        const timeB = parseFloat(b.time_s) || Infinity;
        return timeA - timeB;
      });

      res.json({
        success: true,
        leaderboard_type,
        count: filteredEntries.length,
        entries: filteredEntries
      });

    } catch (error) {
      console.error('Error fetching leaderboard entries:', error);
      res.status(500).json({ error: 'Failed to fetch leaderboard entries' });
    }
  };
}

/**
 * GET /whitelabel/name/:leaderboard_name
 * Fetches all verified entries for a specific leaderboard name (e.g. "RAB")
 * Returns entries sorted by time_s (fastest first)
 */
function getLeaderboardEntriesByName(getShopifyAccessToken, shopifyStoreDomain) {
  return async (req, res) => {
    try {
      const { leaderboard_name } = req.params;

      if (!leaderboard_name) {
        return res.status(400).json({ error: 'leaderboard_name is required' });
      }

      const token = await getShopifyAccessToken();

      const query = `
        query GetLeaderboardEntries($type: String!, $first: Int!) {
          metaobjects(type: $type, first: $first) {
            edges {
              node {
                id
                handle
                fields {
                  key
                  value
                }
              }
            }
            pageInfo {
              hasNextPage
              endCursor
            }
          }
        }
      `;

      const variables = {
        type: 'beer_leaderboard_entry',
        first: 250
      };

      const response = await fetch(
        `https://${shopifyStoreDomain}/admin/api/2024-01/graphql.json`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': token
          },
          body: JSON.stringify({ query, variables })
        }
      );

      const data = await response.json();

      if (data.errors) {
        return res.status(500).json({
          error: 'Failed to fetch entries',
          details: data.errors
        });
      }

      const entries = data.data.metaobjects.edges.map(edge => {
        const fields = {};
        edge.node.fields.forEach(field => {
          fields[field.key] = field.value;
        });

        return {
          id: edge.node.id,
          handle: edge.node.handle,
          ...fields
        };
      });

      console.log('Total entries fetched:', entries.length);
      console.log('Looking for leaderboard_name:', leaderboard_name);

      // Filter by leaderboard_name and only include verified entries
      const filteredEntries = entries.filter(entry => {
        return entry.leaderboard_name === leaderboard_name &&
          entry.verified === 'true';
      });

      // Sort by time_s (fastest times first)
      filteredEntries.sort((a, b) => {
        const timeA = parseFloat(a.time_s) || Infinity;
        const timeB = parseFloat(b.time_s) || Infinity;
        return timeA - timeB;
      });

      res.json({
        success: true,
        leaderboard_name,
        count: filteredEntries.length,
        entries: filteredEntries
      });

    } catch (error) {
      console.error('Error fetching leaderboard entries by name:', error);
      res.status(500).json({ error: 'Failed to fetch leaderboard entries' });
    }
  };
}

module.exports = {
  getLeaderboardEntries,
  getLeaderboardEntriesByName
};
