"""
SageMaker Endpoint Instance Type Update - For Jupyter Notebooks

Copy and paste these cells into your SageMaker Studio Jupyter notebook.

Each section is a separate cell you can run independently.
"""

# ============================================================================
# CELL 1: Setup and List Endpoints
# ============================================================================

import boto3
import json
from datetime import datetime

# Initialize SageMaker client
region = 'us-east-1'  # Change to your region
sagemaker = boto3.client('sagemaker', region_name=region)

print(f"✅ SageMaker client initialized for region: {region}")

# List all endpoints
response = sagemaker.list_endpoints()
endpoints = response.get('Endpoints', [])

print(f"\n📋 Found {len(endpoints)} endpoint(s):\n")

endpoint_info = []
pricing = {
    'ml.t3.xlarge': 0.20,
    'ml.m5.xlarge': 0.23,
    'ml.m5.2xlarge': 0.46,
    'ml.g4dn.xlarge': 0.526,
    'ml.g5.xlarge': 0.70,
    'ml.g5.2xlarge': 1.40,
    'ml.p3.2xlarge': 3.06,
}

for endpoint in endpoints:
    endpoint_name = endpoint['EndpointName']
    status = endpoint['EndpointStatus']
    
    try:
        endpoint_desc = sagemaker.describe_endpoint(EndpointName=endpoint_name)
        config_name = endpoint_desc['EndpointConfigName']
        config = sagemaker.describe_endpoint_config(EndpointConfigName=config_name)
        
        instance_type = config['ProductionVariants'][0]['InstanceType']
        initial_count = config['ProductionVariants'][0]['InitialInstanceCount']
        model_name = config['ProductionVariants'][0]['ModelName']
        
        hourly_cost = pricing.get(instance_type, 0)
        monthly_cost = hourly_cost * 24 * 30 * initial_count
        
        endpoint_info.append({
            'name': endpoint_name,
            'status': status,
            'instance_type': instance_type,
            'instance_count': initial_count,
            'model_name': model_name,
            'config_name': config_name,
            'monthly_cost': monthly_cost
        })
        
        print(f"🔹 {endpoint_name}")
        print(f"   Status: {status}")
        print(f"   Instance: {instance_type} (x{initial_count})")
        print(f"   Monthly Cost: ${monthly_cost:.2f}")
        print(f"   Model: {model_name}")
        print()
    except Exception as e:
        print(f"🔹 {endpoint_name} (Status: {status}, Error: {str(e)})\n")

total_monthly = sum(info['monthly_cost'] for info in endpoint_info)
print(f"📊 Total Monthly Cost: ${total_monthly:.2f}")

# ============================================================================
# CELL 2: Update Single Endpoint (CONFIGURE THIS)
# ============================================================================

# ⚙️ CONFIGURATION - Change these values
ENDPOINT_NAME = 'your-endpoint-name'  # ⬅️ CHANGE THIS
NEW_INSTANCE_TYPE = 'ml.g5.xlarge'    # ⬅️ CHANGE THIS

# Recommended instance types:
# - ml.g5.xlarge (50% cheaper than g5.2xlarge, good performance)
# - ml.g4dn.xlarge (62% cheaper, good for vision)
# - ml.t3.xlarge (85% cheaper, for light workloads)

print(f"🎯 Target endpoint: {ENDPOINT_NAME}")
print(f"🎯 New instance type: {NEW_INSTANCE_TYPE}\n")

# Get current configuration
endpoint_desc = sagemaker.describe_endpoint(EndpointName=ENDPOINT_NAME)
current_config_name = endpoint_desc['EndpointConfigName']
current_config = sagemaker.describe_endpoint_config(EndpointConfigName=current_config_name)

current_instance = current_config['ProductionVariants'][0]['InstanceType']
print(f"📊 Current instance type: {current_instance}")

if current_instance == NEW_INSTANCE_TYPE:
    print("⚠️ Instance type is already set to this value. No change needed.")
else:
    print(f"✅ Ready to update from {current_instance} to {NEW_INSTANCE_TYPE}")

# ============================================================================
# CELL 3: Create New Configuration
# ============================================================================

# Create new endpoint configuration
timestamp = datetime.now().strftime('%Y%m%d-%H%M%S')
new_config_name = f"{current_config_name}-{NEW_INSTANCE_TYPE.replace('.', '-')}-{timestamp}"

# Update production variants
variants = current_config['ProductionVariants']
new_variants = []
for variant in variants:
    new_variant = variant.copy()
    new_variant['InstanceType'] = NEW_INSTANCE_TYPE
    new_variants.append(new_variant)

print(f"🔧 Creating new endpoint configuration: {new_config_name}")

try:
    sagemaker.create_endpoint_config(
        EndpointConfigName=new_config_name,
        ProductionVariants=new_variants
    )
    print(f"✅ Created new endpoint configuration: {new_config_name}")
except Exception as e:
    print(f"❌ Error: {e}")
    raise

# ============================================================================
# CELL 4: Update Endpoint
# ============================================================================

print(f"🔄 Updating endpoint {ENDPOINT_NAME}...")
print("⚠️  This will make the endpoint unavailable for 10-20 minutes\n")

try:
    sagemaker.update_endpoint(
        EndpointName=ENDPOINT_NAME,
        EndpointConfigName=new_config_name
    )
    print(f"✅ Endpoint update initiated!")
    print(f"📊 Check status in next cell")
except Exception as e:
    print(f"❌ Error: {e}")
    raise

# ============================================================================
# CELL 5: Monitor Status (Optional - Run this to watch progress)
# ============================================================================

import time

print("⏳ Monitoring endpoint update...")
print("   (Press Ctrl+C to stop monitoring)\n")

try:
    while True:
        endpoint = sagemaker.describe_endpoint(EndpointName=ENDPOINT_NAME)
        status = endpoint['EndpointStatus']
        
        print(f"Status: {status} - {datetime.now().strftime('%H:%M:%S')}")
        
        if status == 'InService':
            print("\n✅ Endpoint is now in service with new instance type!")
            
            # Verify
            config_name = endpoint['EndpointConfigName']
            config = sagemaker.describe_endpoint_config(EndpointConfigName=config_name)
            actual_instance = config['ProductionVariants'][0]['InstanceType']
            print(f"✅ Verified instance type: {actual_instance}")
            break
        elif status in ['Failed', 'RollingBack']:
            print(f"\n❌ Update failed with status: {status}")
            break
        
        time.sleep(30)
except KeyboardInterrupt:
    print("\n⏸️  Monitoring stopped")
except Exception as e:
    print(f"\n❌ Error: {e}")

# ============================================================================
# CELL 6: Calculate Savings
# ============================================================================

old_hourly = pricing.get(current_instance, 0)
new_hourly = pricing.get(NEW_INSTANCE_TYPE, 0)

if old_hourly > 0 and new_hourly > 0:
    old_monthly = old_hourly * 24 * 30
    new_monthly = new_hourly * 24 * 30
    savings = old_monthly - new_monthly
    savings_pct = (savings / old_monthly) * 100
    
    print(f"💰 Cost Comparison for {ENDPOINT_NAME}:\n")
    print(f"   Old: {current_instance} = ${old_monthly:.2f}/month")
    print(f"   New: {NEW_INSTANCE_TYPE} = ${new_monthly:.2f}/month")
    print(f"   💵 Savings: ${savings:.2f}/month ({savings_pct:.1f}%)")
    print(f"   💵 Annual savings: ${savings * 12:.2f}")
else:
    print(f"⚠️  Pricing not available for comparison")
