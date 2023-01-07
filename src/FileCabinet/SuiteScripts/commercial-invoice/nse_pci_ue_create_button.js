/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define([], () => {
    /**
     * Creates the button to print Commercial Invoice on the Item Fulfillment Record
     */
    const beforeLoad = (context) => {
        let salesOrderId = context.newRecord.getValue({
            fieldId: 'createdfrom'
        });
        let itemFulfillmentId = context.newRecord.id;

        context.form.clientScriptModulePath = 'SuiteScripts/commercial-invoice/nse_pci_cl_open_suitelet';
        context.form.addButton({
            id: 'custpage_print_ci',
            label: 'Print Commercial Invoice',
            functionName: `printCommercialInvoice(${salesOrderId} , ${itemFulfillmentId})`
        });
    }
    return {
        beforeLoad,
    };
}); 