import { getEncomendaById } from '../../utils/supabase';

const VALID_ID = /^[a-zA-Z0-9_\-]{1,50}$/;

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ error: 'ID não fornecido' });
  }

  const sanitizedId = id.toString().trim();
  if (!VALID_ID.test(sanitizedId)) {
    return res.status(400).json({ error: 'ID inválido' });
  }

  try {
    const encomenda = await getEncomendaById(sanitizedId);
    if (!encomenda) {
      return res.status(404).json({ error: 'Encomenda não encontrada' });
    }

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json(encomenda);
  } catch (err) {
    console.error('Erro interno do servidor.');
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}
