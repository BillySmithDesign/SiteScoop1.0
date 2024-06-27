export default function handler(req, res) {
  const paid = true; // Replace with actual check

  res.status(200).json({ paid });
}
