SELECT
    c.CustName_v as "customer",
    c.IntId_v as "internal id",
    cc.CctContact_v as "contact person",
    cc.CctDesignation_v as "designation",
    cc.CctTel1_v as "tel no 1",
    cc.CctTel2_v as "tel no 2",
    cc.CctEmail_v "email address",
    cc.__Def_i "default",
    cc.Status_i as "status"
FROM tbl_customer c
LEFT JOIN tbl_cust_contact cc ON c.CustId_i = cc.CctId_i