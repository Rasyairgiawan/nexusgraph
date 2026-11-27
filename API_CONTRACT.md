# NexusGraph API Contract (Backend Ready)

Base URL (Local): http://localhost:3000

## 1. Ambil Semua Skripsi
- Endpoint: GET /api/search
- Response (200 OK):
~~~json
{
  "results": [
    {
      "id": "uuid",
      "file_name": "19650062.pdf",
      "title": "...",
      "author": "...",
      "year": 2024,
      "problem": "...",
      "method": "...",
      "dataset": "...",
      "limitation": "...",
      "future_work": "...",
      "is_verified": false,
      "gap_claimed_by": null,
      "gap_claimed_at": null
    }
  ]
}
~~~

## 2. Semantic Search (Vector Similarity)
- Endpoint: POST /api/search
- Body:
~~~json
{
  "query": "klasifikasi citra sel darah",
  "threshold": 0.50,
  "count": 10
}
~~~
- Response: Sama seperti GET /api/search, ditambah field "similarity": 0.78.

## 3. Human-in-the-Loop Verification & Claim Research Gap
- Endpoint: PATCH /api/theses/{id}
- Contoh Body (Verifikasi / Edit Hasil AI):
~~~json
{
  "method": "SqueezeNet CNN",
  "is_verified": true
}
~~~
- Contoh Body (Claim Research Gap):
~~~json
{
  "gap_claimed_by": "Moch. Rasya Irgiawan (NIM 240605110128)"
}
~~~
(Kirim "gap_claimed_by": null untuk membatalkan klaim).
