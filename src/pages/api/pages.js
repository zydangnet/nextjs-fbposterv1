import { getSession } from "next-auth/react";
import axios from "axios";

export default async function handler(req, res) {
  const session = await getSession({ req });
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  try {
    const result = await axios.get(`https://graph.facebook.com/v24.0/me/accounts?access_token=${session.accessToken}`);
    const pages = result.data.data.map((page) => ({ id: page.id, name: page.name, access_token: page.access_token }));
    res.status(200).json(pages);
  } catch (err) {
    console.error("Facebook API Error:", err.response?.data || err.message);
    res.status(500).json({ error: "Failed to fetch pages" });
  }
}