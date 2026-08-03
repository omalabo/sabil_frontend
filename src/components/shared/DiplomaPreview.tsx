import React from 'react'

export interface DiplomeForm {
  classe_id: string
  eleve_id: string
  nom_eleve_diplome: string
  matiere: string
  note_orale: string
  note_ecrite: string
  appreciation: string
  delivre_at: string
}

function fmtDate(iso: string) {
  if (!iso) return { day: '........', month: '........', year: '........' }
  const [y, m, d] = iso.split('-')
  return { day: d, month: m, year: y }
}

export function DiplomaPreview({
  form,
  professeurNom,
}: {
  form: DiplomeForm
  professeurNom: string
}) {
  const { day, month, year } = fmtDate(form.delivre_at)

  return (
    <div
      className="relative bg-white font-serif select-none"
      style={{ width: 794, minHeight: 560, fontFamily: 'Georgia, serif' }}
    >
      {/* Bandes latérales + haut/bas + cadre doré + coins (inchangés) */}
      <div className="absolute inset-y-0 left-0 flex flex-col" style={{ width: 18 }}>
        <div className="flex-1 bg-red-500" />
        <div className="flex-1 bg-yellow-400" />
        <div className="flex-1 bg-blue-500" />
        <div className="flex-1 bg-green-500" />
      </div>
      <div className="absolute inset-y-0 right-0 flex flex-col" style={{ width: 18 }}>
        <div className="flex-1 bg-fuchsia-500" />
        <div className="flex-1 bg-blue-500" />
        <div className="flex-1 bg-yellow-400" />
        <div className="flex-1 bg-green-500" />
      </div>
      <div className="absolute top-0 inset-x-0 flex" style={{ height: 10, left: 18, right: 18 }}>
        <div className="flex-1 bg-blue-500" />
        <div className="flex-1 bg-yellow-400" />
        <div className="flex-1 bg-red-500" />
        <div className="flex-1 bg-green-500" />
        <div className="flex-1 bg-fuchsia-500" />
      </div>
      <div className="absolute bottom-0 inset-x-0 flex" style={{ height: 10, left: 18, right: 18 }}>
        <div className="flex-1 bg-fuchsia-500" />
        <div className="flex-1 bg-green-500" />
        <div className="flex-1 bg-red-500" />
        <div className="flex-1 bg-yellow-400" />
        <div className="flex-1 bg-blue-500" />
      </div>
      <div
        className="absolute border-2 border-yellow-600"
        style={{ top: 16, bottom: 16, left: 24, right: 24, borderStyle: 'double', borderWidth: '3px' }}
      />
      {[
        { top: 8, left: 22 }, { top: 8, right: 22 },
        { bottom: 8, left: 22 }, { bottom: 8, right: 22 },
      ].map((pos, i) => (
        <div key={i} className="absolute text-yellow-600 text-2xl leading-none" style={{ ...pos }}>
          ✦
        </div>
      ))}

      {/* Contenu */}
      <div className="relative z-10 flex flex-col items-center px-16 pt-10 pb-8">
        <div className="mb-1 text-center">
          <div className="text-2xl mb-1" style={{ fontFamily: 'serif', color: '#8B6914' }}>
            سَبِيلُ الْعِلْمِ
          </div>
          <div className="flex items-baseline gap-0.5 justify-center text-3xl font-bold tracking-tight leading-none">
            <span className="text-blue-600">S</span>
            <span className="text-yellow-500">a</span>
            <span className="text-red-500">b</span>
            <span className="text-green-600">i</span>
            <span className="text-blue-600">l</span>
            <span className="mx-1 text-neutral-400 font-light">al</span>
            <span className="text-red-500">I</span>
            <span className="text-green-600">l</span>
            <span className="text-yellow-500">m</span>
          </div>
          <div className="text-xs tracking-widest text-neutral-400 mt-0.5">
            Le chemin de la Science
          </div>
        </div>

        <div className="flex items-center gap-2 w-40 my-3">
          <div className="flex-1 h-px bg-gradient-to-r from-transparent to-yellow-500" />
          <div className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
          <div className="flex-1 h-px bg-gradient-to-l from-transparent to-yellow-500" />
        </div>

        <h1 className="text-4xl font-extrabold tracking-wide text-blue-800 uppercase mb-1" style={{ letterSpacing: '0.08em' }}>
          Attestation de Réussite
        </h1>
        <p className="text-xs tracking-[0.25em] text-neutral-600 uppercase mb-0.5">
          Institut de Sciences Religieuses
        </p>
        <p className="text-sm font-bold tracking-widest uppercase mb-4" style={{ color: '#e44d7b' }}>
          — Sabil Al Ilm —
        </p>

        <p className="text-sm text-neutral-600 mb-1">L'institut Sabil al Ilm atteste que l'élève</p>

        <div className="relative w-full text-center mb-3">
          <div className="inline-block px-2 text-blue-700 text-xl" style={{ fontFamily: 'cursive', minWidth: 300 }}>
            {form.nom_eleve_diplome || 'Nom et Prénom de l\'élève'}
          </div>
          <div className="border-b border-neutral-400 absolute bottom-0 left-8 right-8" />
        </div>

        <p className="text-sm text-neutral-600 mb-1">à suivi la session sur :</p>

        <div className="relative w-full text-center mb-5">
          <div className="inline-block px-2 text-blue-700 text-lg" style={{ fontFamily: 'cursive', minWidth: 260 }}>
            {form.matiere || 'Matière'}
          </div>
          <div className="border-b border-neutral-400 absolute bottom-0 left-20 right-20" />
        </div>

        <div className="flex items-center gap-8 w-full mb-4 px-4">
          <div className="flex items-center gap-2 flex-1">
            <div className="w-7 h-7 rounded-full bg-blue-700 flex items-center justify-center text-white text-xs shrink-0">📖</div>
            <span className="text-sm text-neutral-700">Note orale :</span>
            <span className="border-b border-neutral-400 flex-1 text-center text-sm font-medium text-blue-800">
              {form.note_orale || ''}
            </span>
            <span className="text-sm text-neutral-600">/ 20</span>
          </div>
          <div className="w-px h-6 bg-neutral-300" />
          <div className="flex items-center gap-2 flex-1">
            <div className="w-7 h-7 rounded-full bg-yellow-400 flex items-center justify-center text-white text-xs shrink-0">💬</div>
            <span className="text-sm text-neutral-700">Note écrite :</span>
            <span className="border-b border-neutral-400 flex-1 text-center text-sm font-medium text-blue-800">
              {form.note_ecrite || ''}
            </span>
            <span className="text-sm text-neutral-600">/ 20</span>
          </div>
        </div>

        <div className="flex items-start gap-2 w-full px-4 mb-6">
          <div className="w-7 h-7 rounded-full bg-green-500 flex items-center justify-center text-white text-xs shrink-0 mt-0.5">⭐</div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm text-neutral-700">Appréciation :</span>
              <span className="flex-1 border-b border-neutral-400 text-sm text-neutral-800 pb-0.5">
                {form.appreciation?.split('\n')[0] || ''}
              </span>
            </div>
            <div className="border-b border-neutral-400 text-sm text-neutral-800 pb-0.5 ml-24">
              {form.appreciation?.split('\n')[1] || ''}
            </div>
          </div>
        </div>

        <div className="flex items-end justify-between w-full px-4 mt-2">
          <div className="flex items-center gap-2">
            <div className="text-pink-400 text-xl">👤</div>
            <div>
              <div className="text-xs text-neutral-500">Nom de l'enseignante :</div>
              <div className="border-b border-neutral-400 text-sm font-medium text-neutral-800 min-w-[120px] pt-0.5">
                {professeurNom || ''}
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center justify-center rounded-full border-2 border-blue-700 text-center" style={{ width: 90, height: 90 }}>
            <div className="text-blue-700 text-[7px] tracking-wide font-bold uppercase">Institut de Sciences Religieuses</div>
            <div className="text-blue-700 text-xs font-bold">Sabil al Ilm</div>
            <div className="text-blue-600 text-[7px]">Le chemin de la Science</div>
            <div className="text-blue-700 text-[7px] tracking-widest font-semibold uppercase">Sabil al Ilm</div>
          </div>

          <div className="text-right">
            <div className="flex items-center gap-1 text-sm text-neutral-700 mb-3">
              <span>📅</span><span>Date :</span>
              <span className="border-b border-neutral-400 px-1 min-w-[24px] text-center">{day}</span>
              <span>/</span>
              <span className="border-b border-neutral-400 px-1 min-w-[24px] text-center">{month}</span>
              <span>/</span>
              <span className="border-b border-neutral-400 px-1 min-w-[32px] text-center">{year}</span>
            </div>
            <div className="text-sm text-neutral-600 italic flex items-center gap-1 justify-end">
              <span>✒️</span><span>Signature</span>
            </div>
            <div className="border-b border-neutral-400 w-32 mt-2" />
          </div>
        </div>
      </div>
    </div>
  )
}