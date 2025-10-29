select
	pr.id,
	pr.request_number,
	pri.description ,
	pri.requested_quantity ,
	pri.approved_quantity,
	q.id as quotation_id,
	q.quotation_number,
		qi.description ,
	qi.quantity,
	sqi.available_quantity,
	sqi.confirmed_unit,
	sqi.supplier_quotation_id
from
	purchase_requests pr
inner join purchase_request_items pri on
	pri.purchase_request_id = pr.id
left join quotations q on
	q.purchase_request_id = pr.id
left join quotation_items qi on
	qi.quotation_id = q.id
	and qi.purchase_request_item_id = pri.id
left join supplier_quotations sq on
	sq.quotation_id = q.id
left join supplier_quotation_items sqi on
	sqi.supplier_quotation_id = sq.id
	and sqi.quotation_item_id = qi.id
where
	pr.request_number = 'SOL-2025-325'