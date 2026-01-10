/**
 * Admin Dashboard Endpoints for Chug Champ Verification
 * 
 * PRD: Admin Verification Dashboard
 * 
 * Purpose:
 * Provide backend endpoints for an admin dashboard to review and verify user-submitted
 * chug videos before they appear on the public leaderboard.
 * 
 * User Flow:
 * 1. Admin opens dashboard
 * 2. Dashboard fetches one unverified submission at a time
 * 3. Admin reviews video and submission details
 * 4. Admin can either:
 *    - Update/edit fields if corrections needed (typos, inappropriate content, etc.)
 *    - Verify submission to approve it for public leaderboard
 * 5. Upon action, next unverified submission loads automatically
 * 
 * Metaobject Schema:
 * - type: 'leaderboard_submission'
 * - fields:
 *   - name: string (user's name or handle)
 *   - category: string ("Beer/Seltzer" or "Non-Alc")
 *   - beverage: string (beverage name)
 *   - video_url: string (public video URL)
 *   - social_url: string (optional - user's social profile)
 *   - location: string (optional - city, state, country)
 *   - verified: boolean (false by default, true when approved)
 * 
 * Endpoints:
 * 
 * GET /admin/unverified
 * - Fetches one unverified submission (verified: false)
 * - Returns submission with all fields and metaobject ID
 * - Returns 404 if no unverified submissions exist
 * 
 * PATCH /admin/submission/:id
 * - Updates specific fields of a submission
 * - Does NOT change verified status
 * - Used for corrections/edits
 * 
 * POST /admin/verify/:id
 * - Sets verified: true on a submission
 * - Approves submission for public leaderboard
 */

/**
 * GET /admin/unverified
 * Fetch one unverified submission
 */
function getUnverifiedSubmission(getShopifyAccessToken, SHOPIFY_STORE_DOMAIN) {
  return async (req, res) => {
    try {
      const token = await getShopifyAccessToken();

      const query = `
        query GetUnverifiedSubmissions {
          metaobjects(type: "beer_leaderboard_entry", first: 100) {
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
          }
        }
      `;

      const response = await fetch(`https://${SHOPIFY_STORE_DOMAIN}/admin/api/2024-01/graphql.json`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': token
        },
        body: JSON.stringify({ query })
      });

      const data = await response.json();

      if (data.errors) {
        return res.status(400).json({ 
          error: 'Failed to fetch submissions',
          details: data.errors
        });
      }

      const submissions = data.data?.metaobjects?.edges || [];
      
      const unverified = submissions.find(edge => {
        const fields = edge.node.fields;
        const verifiedField = fields.find(f => f.key === 'verified');
        return verifiedField?.value === 'false';
      });

      if (!unverified) {
        return res.status(404).json({ 
          message: 'No unverified submissions found'
        });
      }

      const node = unverified.node;
      const fieldsObj = {};
      node.fields.forEach(field => {
        fieldsObj[field.key] = field.value;
      });

      res.json({
        id: node.id,
        handle: node.handle,
        fields: fieldsObj
      });

    } catch (error) {
      console.error('Error fetching unverified submissions:', error);
      res.status(500).json({ error: 'Failed to fetch submissions' });
    }
  };
}

/**
 * PATCH /admin/submission/:id
 * Update submission fields (does not change verified status)
 */
function updateSubmission(getShopifyAccessToken, SHOPIFY_STORE_DOMAIN) {
  return async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;

      if (!id) {
        return res.status(400).json({ error: 'Submission ID required' });
      }

      delete updates.verified;

      const token = await getShopifyAccessToken();

      const fields = Object.entries(updates).map(([key, value]) => ({
        key,
        value: String(value)
      }));

      const mutation = `
        mutation UpdateMetaobject($id: ID!, $metaobject: MetaobjectUpdateInput!) {
          metaobjectUpdate(id: $id, metaobject: $metaobject) {
            metaobject {
              id
              handle
              fields {
                key
                value
              }
            }
            userErrors {
              field
              message
            }
          }
        }
      `;

      const variables = {
        id,
        metaobject: {
          fields
        }
      };

      const response = await fetch(`https://${SHOPIFY_STORE_DOMAIN}/admin/api/2024-01/graphql.json`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': token
        },
        body: JSON.stringify({ query: mutation, variables })
      });

      const data = await response.json();

      if (data.errors || data.data?.metaobjectUpdate?.userErrors?.length > 0) {
        return res.status(400).json({ 
          error: 'Failed to update submission',
          details: data.errors || data.data.metaobjectUpdate.userErrors
        });
      }

      const node = data.data.metaobjectUpdate.metaobject;
      const fieldsObj = {};
      node.fields.forEach(field => {
        fieldsObj[field.key] = field.value;
      });

      res.json({
        success: true,
        submission: {
          id: node.id,
          handle: node.handle,
          fields: fieldsObj
        }
      });

    } catch (error) {
      console.error('Error updating submission:', error);
      res.status(500).json({ error: 'Failed to update submission' });
    }
  };
}

/**
 * POST /admin/verify/:id
 * Mark submission as verified (approved for public leaderboard)
 */
function verifySubmission(getShopifyAccessToken, SHOPIFY_STORE_DOMAIN) {
  return async (req, res) => {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({ error: 'Submission ID required' });
      }

      const token = await getShopifyAccessToken();

      const mutation = `
        mutation UpdateMetaobject($id: ID!, $metaobject: MetaobjectUpdateInput!) {
          metaobjectUpdate(id: $id, metaobject: $metaobject) {
            metaobject {
              id
              handle
              fields {
                key
                value
              }
            }
            userErrors {
              field
              message
            }
          }
        }
      `;

      const variables = {
        id,
        metaobject: {
          fields: [
            { key: 'verified', value: 'true' }
          ]
        }
      };

      const response = await fetch(`https://${SHOPIFY_STORE_DOMAIN}/admin/api/2024-01/graphql.json`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': token
        },
        body: JSON.stringify({ query: mutation, variables })
      });

      const data = await response.json();

      if (data.errors || data.data?.metaobjectUpdate?.userErrors?.length > 0) {
        return res.status(400).json({ 
          error: 'Failed to verify submission',
          details: data.errors || data.data.metaobjectUpdate.userErrors
        });
      }

      const node = data.data.metaobjectUpdate.metaobject;
      const fieldsObj = {};
      node.fields.forEach(field => {
        fieldsObj[field.key] = field.value;
      });

      res.json({
        success: true,
        verified: true,
        submission: {
          id: node.id,
          handle: node.handle,
          fields: fieldsObj
        }
      });

    } catch (error) {
      console.error('Error verifying submission:', error);
      res.status(500).json({ error: 'Failed to verify submission' });
    }
  };
}

module.exports = {
  getUnverifiedSubmission,
  updateSubmission,
  verifySubmission
};
