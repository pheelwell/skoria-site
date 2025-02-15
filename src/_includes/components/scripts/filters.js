// Basic jQuery filter example:
$(document).ready(function(){
  $('#searchInput').on('keyup', function() {
    const term = $(this).val().toLowerCase();
    $('.nav-item').each(function(){
      $(this).toggle($(this).text().toLowerCase().indexOf(term) > -1);
    });
  });

  // Dropdown filters for continent, plane, type
  $('.filter-select').on('change', function() {
    const filterKey = $(this).data('filter');
    const filterVal = $(this).val();
    $('.nav-item').each(function(){
      const value = $(this).data(filterKey) || '';
      if (filterVal === '' || value === filterVal) { 
        $(this).show(); 
      } else {
        $(this).hide();
      }
    });
  });
});
