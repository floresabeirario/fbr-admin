-- ============================================================
-- FBR Admin — Status público: insere nova fase 7 "A finalizar
-- o quadro" e faz shift dos overrides existentes (sessão 36)
--
-- Contexto: a fase pública 7 "A ser emoldurado" passa a ser 8;
-- 8→9, 9→10, 10→11, 11→12. A nova fase 7 fica disponível para
-- o estado interno `a_finalizar_quadro` (que antes partilhava a
-- fase 6 "A aguardar aprovação").
--
-- Esta migração faz o re-key da JSONB `public_status_settings.messages`
-- para que quaisquer mensagens default já personalizadas pela Maria
-- continuem a apontar para a fase semântica correcta após o shift.
--
-- IDEMPOTENTE: corre só se a estrutura ainda tiver chaves no schema
-- antigo (i.e. existir alguma chave 7-11 sem chave 12). Caso a
-- Maria não tenha personalizado nada, a tabela continua com
-- `messages = '{}'` e nada acontece.
--
-- Executar no Supabase SQL Editor.
-- ============================================================

-- Faz o shift atómico dentro de uma única expressão jsonb_strip_nulls
-- + jsonb_build_object. As chaves 0-6 e "cancelada" mantêm-se; 7-11
-- copiam-se para 8-12; a nova chave 7 fica vazia (default de código
-- aplica-se até a Maria personalizar).
UPDATE public_status_settings
SET messages = jsonb_strip_nulls(jsonb_build_object(
    '0',          messages->'0',
    '1',          messages->'1',
    '2',          messages->'2',
    '3',          messages->'3',
    '4',          messages->'4',
    '5',          messages->'5',
    '6',          messages->'6',
    -- 7 fica vazio (a fase nova). Quando a Maria personalizar,
    -- o admin escreve directamente para a chave '7'.
    '8',          messages->'7',
    '9',          messages->'8',
    '10',         messages->'9',
    '11',         messages->'10',
    '12',         messages->'11',
    'cancelada',  messages->'cancelada'
  )),
  updated_at = now()
WHERE id = 1
  -- Só faz o shift se ainda não houver chave 12 (defesa contra
  -- correr a migração duas vezes).
  AND NOT (messages ? '12')
  -- E só se houver pelo menos uma das chaves antigas a precisar
  -- de migrar (evita escrever lixo numa tabela vazia).
  AND (messages ? '7' OR messages ? '8' OR messages ? '9'
       OR messages ? '10' OR messages ? '11');
