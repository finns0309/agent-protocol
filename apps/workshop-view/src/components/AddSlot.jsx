export function AddSlot({ onClick }) {
  return (
    <button className="add-slot" onClick={onClick} type="button">
      <span className="add-slot-mark">+</span>
    </button>
  );
}
