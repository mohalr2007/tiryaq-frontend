/* eslint-disable @next/next/no-img-element */
function Profile() {
  return (
    <img
      src="https://i.imgur.com/QIrZWGIs.jpg"
      alt="Alan L. Hart"
    />
  );
}
export default function Gallery() {
     return (
          <div>
               <Profile/>
               <Profile/>
               <Profile/>
          </div>
     );
}
