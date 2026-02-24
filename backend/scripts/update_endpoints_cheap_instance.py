"""
Update SageMaker Endpoints to Cheapest Valid Instance Type

⚠️  IMPORTANT: ml.t3.medium is NOT available for SageMaker inference endpoints!

Valid cheap instance types (from error message):
- ml.c5.large (~$0.10/hour = ~$72/month) - RECOMMENDED
- ml.m5.large (~$0.115/hour = ~$83/month)
- ml.t2.xlarge (~$0.20/hour = ~$144/month)

Copy each section into a separate notebook cell.
"""

# ============================================================================
# CELL 1: Setup and List All Endpoints
# ============================================================================

import boto3
from datetime import datetime

region = 'us-east-2'  # Your region
sagemaker = boto3.client('sagemaker', region_name=region)

# Use ml.c5.large (cheapest valid option for SageMaker inference)
NEW_INSTANCE_TYPE = 'ml.c5.large'  # ~$0.10/hour = ~$72/month per endpoint

# List all endpoints
response = sagemaker.list_endpoints()
endpoints = response.get('Endpoints', [])

print(f"📋 Found {len(endpoints)} endpoint(s):\n")

endpoint_list = []
for ep in endpoints:
    ep_name = ep['EndpointName']
    status = ep['EndpointStatus']
    
    try:
        endpoint_desc = sagemaker.describe_endpoint(EndpointName=ep_name)
        config_name = endpoint_desc['EndpointConfigName']
        config = sagemaker.describe_endpoint_config(EndpointConfigName=config_name)
        instance_type = config['ProductionVariants'][0]['InstanceType']
        model_name = config['ProductionVariants'][0]['ModelName']
        
        endpoint_list.append({
            'name': ep_name,
            'status': status,
            'instance_type': instance_type,
            'model_name': model_name,
            'config_name': config_name,
            'config': config,
            'endpoint_desc': endpoint_desc
        })
        
        print(f"🔹 {ep_name}")
        print(f"   Status: {status}")
        print(f"   Instance: {instance_type}")
        print(f"   Model: {model_name}")
        print()
    except Exception as e:
        print(f"🔹 {ep_name} (Error: {str(e)})\n")

print(f"✅ Ready to update {len(endpoint_list)} endpoint(s) to {NEW_INSTANCE_TYPE}")

# ============================================================================
# CELL 2: Calculate Cost Savings
# ============================================================================

pricing = {
    'ml.c5.large': 0.10,      # Cheapest valid option
    'ml.m5.large': 0.115,
    'ml.t2.xlarge': 0.20,
    'ml.c5.xlarge': 0.20,
    'ml.m5.xlarge': 0.23,
    'ml.g5.xlarge': 0.70,
    'ml.g5.2xlarge': 1.40,
    'ml.p3.2xlarge': 3.06,
}

print("💰 Cost Analysis:\n")
total_current = 0
total_new = 0

for ep in endpoint_list:
    current_hourly = pricing.get(ep['instance_type'], 0)
    current_monthly = current_hourly * 24 * 30
    new_monthly = 0.10 * 24 * 30  # ml.c5.large
    savings = current_monthly - new_monthly
    
    total_current += current_monthly
    total_new += new_monthly
    
    print(f"{ep['name']}:")
    print(f"  Current: {ep['instance_type']} = ${current_monthly:.2f}/month")
    print(f"  New: {NEW_INSTANCE_TYPE} = ${new_monthly:.2f}/month")
    print(f"  💵 Savings: ${savings:.2f}/month")
    print()

print(f"📊 Total:")
print(f"  Current: ${total_current:.2f}/month")
print(f"  New: ${total_new:.2f}/month")
print(f"  💵 Total Savings: ${total_current - total_new:.2f}/month (${(total_current - total_new) * 12:.2f}/year)")

# ============================================================================
# CELL 3: Update All Endpoints
# ============================================================================

print(f"⚠️  NOTE: Using {NEW_INSTANCE_TYPE} (cheapest valid instance type)")
print(f"   ml.t3.medium is NOT available for SageMaker inference endpoints")
print(f"   This will update {len(endpoint_list)} endpoint(s).")
print(f"   Each will be unavailable for 10-20 minutes.\n")

# Confirm before proceeding
confirm = input("Type 'yes' to continue: ")

if confirm.lower() != 'yes':
    print("Cancelled.")
else:
    # Update each endpoint
    results = []
    for ep in endpoint_list:
        ep_name = ep['name']
        print(f"\n{'='*60}")
        print(f"🔄 Updating: {ep_name}")
        print(f"{'='*60}")
        
        # Create new config
        timestamp = datetime.now().strftime('%Y%m%d-%H%M%S')
        new_config_name = f"{ep['config_name']}-{NEW_INSTANCE_TYPE.replace('.', '-')}-{timestamp}"
        
        variants = ep['config']['ProductionVariants']
        new_variants = []
        for variant in variants:
            new_variant = variant.copy()
            new_variant['InstanceType'] = NEW_INSTANCE_TYPE
            new_variants.append(new_variant)
        
        try:
            # Create new config
            sagemaker.create_endpoint_config(
                EndpointConfigName=new_config_name,
                ProductionVariants=new_variants
            )
            print(f"✅ Created config: {new_config_name}")
            
            # Update endpoint
            sagemaker.update_endpoint(
                EndpointName=ep_name,
                EndpointConfigName=new_config_name
            )
            print(f"✅ Update initiated for {ep_name}")
            results.append((ep_name, True))
            
        except Exception as e:
            print(f"❌ Error: {e}")
            results.append((ep_name, False))
    
    # Summary
    print(f"\n{'='*60}")
    print("📊 Update Summary")
    print(f"{'='*60}")
    for ep_name, success in results:
        status = "✅" if success else "❌"
        print(f"  {status} {ep_name}")

# ============================================================================
# CELL 4: Monitor Update Status (Optional)
# ============================================================================

import time

# Monitor updates
for ep in endpoint_list:
    ep_name = ep['name']
    print(f"\n⏳ Monitoring {ep_name}...")
    
    try:
        while True:
            endpoint = sagemaker.describe_endpoint(EndpointName=ep_name)
            status = endpoint['EndpointStatus']
            
            print(f"  Status: {status} - {datetime.now().strftime('%H:%M:%S')}")
            
            if status == 'InService':
                # Verify instance type
                config_name = endpoint['EndpointConfigName']
                config = sagemaker.describe_endpoint_config(EndpointConfigName=config_name)
                actual_instance = config['ProductionVariants'][0]['InstanceType']
                print(f"  ✅ In service! Instance: {actual_instance}")
                break
            elif status in ['Failed', 'RollingBack']:
                print(f"  ❌ Failed with status: {status}")
                break
            
            time.sleep(30)
    except KeyboardInterrupt:
        print(f"  ⏸️  Stopped monitoring {ep_name}")
    except Exception as e:
        print(f"  ❌ Error: {e}")
