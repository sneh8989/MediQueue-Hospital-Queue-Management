export default function SelectInput({ label, error, options, placeholder, className = '', ...props }) {
  return (
    <div className={className}>
      {label && (
        <label htmlFor={props.id || props.name} className="mb-1 block text-sm font-medium text-slate-700">
          {label}
        </label>
      )}
      <select
        id={props.id || props.name}
        {...props}
        className={`w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:ring-2 ${
          error
            ? 'border-red-300 focus:border-red-500 focus:ring-red-100'
            : 'border-slate-300 focus:border-brand-500 focus:ring-brand-100'
        }`}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
